// ============================================================================
// FİNANS MOTORU — Tek Kaynak (Single Source of Truth)
// ============================================================================
// Tüm finansal hesaplamalar BURADAN geçmeli. Hiçbir sayfa/bileşen "bu ay net",
// "toplam borç", "sağlık skoru" gibi hesapları kendi içinde tekrar yazmamalı.
// Bir hesaplama mantığı değişecekse SADECE bu dosya değişir, uygulamanın her
// yerinde aynı sonuç garanti edilir.
//
// Bu dosyadaki her fonksiyon SAF (pure) — dışarıdan veri alır, hesaplar,
// sonucu döner. Veritabanı sorgusu yapmaz, state tutmaz. Bu, test edilebilir
// ve her sayfada güvenle yeniden kullanılabilir olmasını sağlar.
// ============================================================================

export type Debt = {
  id: string
  remaining_amount: number | string
  status: string
  category?: string
  installment_total?: number | null
  installment_remaining?: number | null
  due_date?: string | null
  interest_rate?: number | string | null
}

export type Transaction = {
  type: 'income' | 'expense'
  category: string
  amount: number | string
  transaction_date: string
}

export type Payment = {
  amount: number | string
  paid_at: string
}

// --- Toplam Borç (aktif borçların kalan tutarları toplamı) ---
export function toplamBorcHesapla(debts: Debt[]): number {
  return debts.filter((d) => d.status === 'active').reduce((s, d) => s + Number(d.remaining_amount), 0)
}

// --- Bir ay aralığındaki gelir/gider/borç ödemesi kırılımı ---
// "Birikimden Çekim" gerçek bir gelir değil (zaten kendi biriktirdiğin para), bu yüzden
// hem gelir hem gider tarafından netleniyor — uygulamanın en başından beri geçerli kural.
export type AyKirilimi = {
  gelir: number
  gider: number
  borcOdeme: number
  net: number
  veriVar: boolean
  islemler: Transaction[]
}

export function ayKirilimiHesapla(
  transactions: Transaction[],
  payments: Payment[],
  ayBaslangic: string, // 'YYYY-MM-DD'
  ayBitis: string,     // 'YYYY-MM-DD' (dahil değil, bir sonraki ayın 1'i)
): AyKirilimi {
  const txBu = transactions.filter((t) => t.transaction_date >= ayBaslangic && t.transaction_date < ayBitis)
  const birikimdenCekim = txBu
    .filter((t) => t.type === 'income' && t.category === 'Birikimden Çekim')
    .reduce((s, t) => s + Number(t.amount), 0)

  const gelir = txBu.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekim
  const gider = txBu.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekim

  const payBu = payments.filter((p) => p.paid_at >= `${ayBaslangic}T00:00:00` && p.paid_at < `${ayBitis}T00:00:00`)
  const borcOdeme = payBu.reduce((s, p) => s + Number(p.amount), 0)

  const veriVar = txBu.length > 0 || borcOdeme > 0

  return { gelir, gider, borcOdeme, net: gelir - gider - borcOdeme, veriVar, islemler: txBu }
}

// --- Toplam Birikim (birikim hedeflerinin güncel tutarları toplamı) ---
export type SavingsGoal = { current_amount: number | string; target_amount?: number | string }

export function toplamBirikimHesapla(hedefler: SavingsGoal[]): number {
  return hedefler.reduce((s, h) => s + Number(h.current_amount), 0)
}

// --- Yapısal aylık borç yükü (taksitli borçların güncel taksit tutarları + KMH'nin asgari faiz maliyeti) ---
// KMH'de sabit taksit yok — bu yüzden "aylık yük" olarak, kalan bakiyenin faiziyle asgari
// maliyetini varsayıyoruz (interest_rate zaten AYLIK olarak saklanıyor, bkz. borç ekleme formu).
export function aylikBorcYukuHesapla(debts: Debt[]): number {
  return debts.reduce((s, d) => {
    if (d.category === 'kmh') {
      const aylikFaizOrani = d.interest_rate ? Number(d.interest_rate) / 100 : 0
      return s + Number(d.remaining_amount) * aylikFaizOrani
    }
    if (d.installment_total && d.installment_remaining) {
      return s + Number(d.remaining_amount) / d.installment_remaining
    }
    return s
  }, 0)
}

// --- Borç/Gelir Oranı ---
export function borcGelirOraniHesapla(aylikBorcYuku: number, buAyGelir: number): number | null {
  if (buAyGelir <= 0) return null
  return aylikBorcYuku / buAyGelir
}

// --- Geciken borç sayısı (bugüne göre) ---
export function gecikenBorcSayisiHesapla(debts: Debt[], bugun: Date): number {
  return debts
    .filter((d) => d.due_date)
    .map((d) => gunKaldiHesapla(d.due_date!, bugun))
    .filter((gun) => gun < 0).length
}

// --- Finansal Sağlık Skoru (0-100) ---
export type SaglikSkoru = {
  skor: number
  nedenler: string[]
  durum: { etiket: string; badge: string; metin: string; cubuk: string }
}

export function saglikSkoruHesapla(params: {
  borcGelirOrani: number | null
  gecikenSayisi: number
  buAyNet: number
  toplamBirikim: number
}): SaglikSkoru {
  const { borcGelirOrani, gecikenSayisi, buAyNet, toplamBirikim } = params
  const nedenler: string[] = []
  let skor = 0

  if (borcGelirOrani === null) {
    skor += 20
  } else if (borcGelirOrani <= 0.20) {
    skor += 40
  } else if (borcGelirOrani <= 0.35) {
    skor += 28
    nedenler.push('Borç/gelir oranın orta seviyede — takipte tut')
  } else if (borcGelirOrani <= 0.50) {
    skor += 12
    nedenler.push('Borç/gelir oranını azaltmaya odaklanmak iyi olur')
  } else {
    nedenler.push('Borç yükün gelirine göre ağır — önceliğin borcu azaltmak olabilir')
  }

  if (gecikenSayisi === 0) {
    skor += 25
  } else {
    nedenler.push(`${gecikenSayisi} borcun gecikmiş — bugün bir göz atmaya değer`)
  }

  if (buAyNet >= 0) {
    skor += 20
  } else {
    nedenler.push('Bu ay gider gelirden fazla oldu — geçici bir dalgalanma olabilir')
  }

  if (toplamBirikim > 0) {
    skor += 15
  } else {
    nedenler.push('Küçük bir birikim hedefi koymak iyi bir başlangıç olur')
  }

  skor = Math.max(0, Math.min(100, skor))

  // Tailwind class'ları TAM/sabit string olarak yazılmalı (dinamik `bg-${x}-soft` derleme zamanında tanınmaz)
  const durum = skor >= 70
    ? { etiket: 'İyi', badge: 'bg-sage-soft text-sage', metin: 'text-sage', cubuk: 'bg-sage' }
    : skor >= 40
      ? { etiket: 'Orta', badge: 'bg-amber-soft text-amber', metin: 'text-amber', cubuk: 'bg-amber' }
      : { etiket: 'Gelişim Alanı', badge: 'bg-brick-soft text-brick', metin: 'text-brick', cubuk: 'bg-brick' }

  return { skor, nedenler, durum }
}

// --- "Birikimden Çekim" netleme kuralı — TEK yerde tanımlı ---
// Birikimden Çekim gerçek bir gelir değil (zaten kendi biriktirdiğin para), bu yüzden hem
// gelir hem gider toplamından AYNI miktar düşülüyor. Bu kural artık her sayfada aynı.
export function birikimdenCekimNetle(islemler: Transaction[]): { gelir: number; gider: number; birikimdenCekimToplami: number } {
  const birikimdenCekimToplami = islemler
    .filter((t) => t.type === 'income' && t.category === 'Birikimden Çekim')
    .reduce((s, t) => s + Number(t.amount), 0)

  const gelir = islemler.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekimToplami
  const gider = islemler.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekimToplami

  return { gelir, gider, birikimdenCekimToplami }
}

// --- Net formülü — TEK yerde tanımlı ---
export function netHesapla(gelir: number, gider: number, borcOdeme: number): number {
  return gelir - gider - borcOdeme
}

// --- Tahmini Ay Sonu Bakiyesi (FAZ 0, madde 3'te tanımlanan doğru formül) ---
// ÖNEMLİ: eski hesap sadece "planlanan borç taksitlerini" düşüyordu, planlanan gelir/gideri
// hiç saymıyordu. Doğru formül ikisini de içeriyor.
export function tahminiAySonuHesapla(params: {
  devredenBakiye: number
  buAyGerceklesenNet: number
  planlananGelir: number
  planlananGider: number
  planlananBorcTaksitleri: number
}): number {
  const { devredenBakiye, buAyGerceklesenNet, planlananGelir, planlananGider, planlananBorcTaksitleri } = params
  return devredenBakiye + buAyGerceklesenNet + planlananGelir - planlananGider - planlananBorcTaksitleri
}

// --- Gerçek Amortisman Simülasyonu (FAZ 0, madde 7'de tanımlanan doğru model) ---
// Bankaların kullandığı "azalan bakiye" yöntemi: her ay faiz, o anki kalan anapara üzerinden
// hesaplanır (düz/basit bir bölme DEĞİL). Bu, gerçek banka kapama tutarlarıyla eşleşen tek
// doğru yöntem.
export type AmortismanSonucu = {
  kalanFaizToplami: number
  aySayisi: number
  toplamOdenecek: number
  gecersiz: boolean // taksit tutarı faizi bile karşılamıyorsa true döner (hesap yapılamaz)
}

export function amortismanSimuleEt(params: {
  kalanAnapara: number
  aylikFaizOrani: number // ondalık — örn %2.5 için 0.025
  aylikTaksitTutari: number
  ekstraOdeme?: number
  maksimumAy?: number // sonsuz döngü koruması
}): AmortismanSonucu {
  const { kalanAnapara, aylikFaizOrani, aylikTaksitTutari, ekstraOdeme = 0, maksimumAy = 600 } = params
  let bakiye = kalanAnapara
  let toplamFaiz = 0
  let ay = 0

  while (bakiye > 0.5 && ay < maksimumAy) {
    const faizPayi = bakiye * aylikFaizOrani
    let anaparaPayi = (aylikTaksitTutari + ekstraOdeme) - faizPayi
    if (anaparaPayi <= 0) {
      return { kalanFaizToplami: NaN, aySayisi: NaN, toplamOdenecek: NaN, gecersiz: true }
    }
    if (anaparaPayi > bakiye) anaparaPayi = bakiye
    bakiye -= anaparaPayi
    toplamFaiz += faizPayi
    ay++
  }

  return { kalanFaizToplami: toplamFaiz, aySayisi: ay, toplamOdenecek: kalanAnapara + toplamFaiz, gecersiz: false }
}

// --- Net Servet (FAZ 0, madde 2) ---
export function netServetHesapla(toplamBirikim: number, toplamBorc: number): number {
  return toplamBirikim - toplamBorc
}

// --- "Kaç gün kaldı" — bugünden verilen tarihe olan gün farkı (negatifse gecikmiş demek) ---
// Önceden Özet ve Bildirim Zili'nde birebir aynı satır iki ayrı yerde yazılıydı.
export function gunKaldiHesapla(tarihStr: string, bugun: Date): number {
  const bugunSifirli = new Date(bugun)
  bugunSifirli.setHours(0, 0, 0, 0)
  const [y, m, g] = tarihStr.split('-').map(Number)
  const t = new Date(y, m - 1, g)
  return Math.round((t.getTime() - bugunSifirli.getTime()) / 86400000)
}

// --- Gider kategorisi dağılımı — kategori bazlı toplam + renk eşleme + sıralama ---
// Önceden Özet ve Gelir-Gider'de ayrı ayrı yazılıydı.
//
// ÖNEMLİ (düzeltme): "Birikimden Çekim" geliri, aynı ayki "Birikim Aktarımı" giderinden
// netlenir (birikimdenCekimNetle ile AYNI kural, tekrar yazılmadan buradan çağrılıyor).
// Bu netleme önceden sadece Gelir-Gider sayfasının kendi inline kodunda vardı, Özet
// sayfası bu fonksiyona taşındığında netleme unutulmuştu — iki sayfa farklı rakam
// gösteriyordu. Artık kural TEK yerde: hangi sayfa çağırırsa çağırsın aynı sonucu alır.
//
// `limit`: varsayılan 5 (Özet'in "mini" görünümü). Tüm kategorileri istiyorsan
// `Infinity` geç (Array.slice(0, Infinity) tüm diziyi döner) — imza değişmez.
export type GiderKalemi = { kategori: string; tutar: number; renk: string }

export function giderKategorileriHesapla(
  islemler: Transaction[],
  renkHaritasi: Record<string, string>,
  limit: number = 5,
): { liste: GiderKalemi[]; enBuyuk: number } {
  const { birikimdenCekimToplami } = birikimdenCekimNetle(islemler)

  const giderMap: Record<string, number> = {}
  islemler
    .filter((t) => t.type === 'expense' && t.category !== 'Birikimden Çekim')
    .forEach((t) => { giderMap[t.category] = (giderMap[t.category] || 0) + Number(t.amount) })

  if (birikimdenCekimToplami > 0 && giderMap['Birikim Aktarımı']) {
    giderMap['Birikim Aktarımı'] = Math.max(0, giderMap['Birikim Aktarımı'] - birikimdenCekimToplami)
  }

  const liste = Object.entries(giderMap)
    .filter(([, tutar]) => tutar > 0)
    .map(([kategori, tutar]) => ({ kategori, tutar, renk: renkHaritasi[kategori] || '#6b6f7a' }))
    .sort((a, b) => b.tutar - a.tutar)
    .slice(0, limit)

  const enBuyuk = Math.max(...liste.map((g) => g.tutar), 1)
  return { liste, enBuyuk }
}

// --- Borç kapanma ay tahmini — son dönemdeki ortalama ödeme hızına göre ---
export function borcKapanmaTahminiHesapla(toplamBorc: number, sonDonemOdemeler: Payment[]): number | null {
  if (toplamBorc <= 0 || sonDonemOdemeler.length === 0) return null
  const toplamOdeme = sonDonemOdemeler.reduce((s, p) => s + Number(p.amount), 0)
  const aylarSet = new Set(sonDonemOdemeler.map((p) => p.paid_at.slice(0, 7)))
  const ortalamaAylikOdeme = toplamOdeme / Math.max(1, aylarSet.size)
  if (ortalamaAylikOdeme <= 0) return null
  return Math.ceil(toplamBorc / ortalamaAylikOdeme)
}

// --- En yüksek faizli borç — önceliklendirme önerisi için ---
export function enYuksekFaizliBorcBul<T extends Debt>(debts: T[]): T | undefined {
  return debts
    .filter((d) => d.interest_rate && Number(d.interest_rate) > 0)
    .sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))[0]
}

// --- Bekleyen Alacaklar (Receivables) ---
// Net Servet'e ve Finansal Sağlık Skoru'na DAHİL EDİLMİYOR — bu, FAZ 0.5'te
// bilinçli olarak alınmış bir karar (henüz kesinleşmemiş parayı varlık gibi
// göstermemek için). Ayrı bir gösterge olarak sunuluyor.
// Not: `id` kasıtlı olarak YOK — bu tip sadece toplamBekleyenAlacakHesapla'nın
// gerçekten kullandığı alanları içeriyor. Sorguyu gereksiz alan çekecek şekilde
// genişletmek yerine, tipi fonksiyonun ihtiyacına göre daralttık.
export type Receivable = {
  remaining_amount: number | string
  status: string
}

export function toplamBekleyenAlacakHesapla(receivables: Receivable[]): number {
  return receivables
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + Number(r.remaining_amount), 0)
}

// --- Ay aralığı (YYYY-MM-DD) üretici — tekrar eden tarih hesaplarını tek yere topluyor ---
export function ikiBasamak(n: number): string {
  return String(n).padStart(2, '0')
}

export function ayAraligiUret(yil: number, ayIndex0: number, hedefAyOffset: number = 0): { baslangic: string; bitis: string; ayIndex: number; yil: number } {
  const tarih = new Date(yil, ayIndex0 - hedefAyOffset, 1)
  const y = tarih.getFullYear()
  const m = tarih.getMonth()
  const baslangic = `${y}-${ikiBasamak(m + 1)}-01`
  const bitYil = m === 11 ? y + 1 : y
  const bitAy = m === 11 ? 0 : m + 1
  const bitis = `${bitYil}-${ikiBasamak(bitAy + 1)}-01`
  return { baslangic, bitis, ayIndex: m, yil: y }
}

// ============================================================================
// BİLDİRİM SİSTEMİ v1 — Yalnızca "hesaplanan" bildirimler (DB'de satır olarak
// durmuyor, her çağrıda mevcut veriden yeniden türetiliyor). Olay tabanlı
// bildirimler (grup harcaması, davet vb.) kapsam dışı — v2'de `notifications`
// tablosu ve RPC'lerle, Finance Engine'in DIŞINDA ele alınacak.
// ============================================================================

export type BildirimTuru = 'borc_yaklasan' | 'borc_gecikti' | 'duzenli_yaklasan' | 'alacak_yaklasan' | 'alacak_gecikti' | 'butce_asildi'
export type BildirimOnceligi = 'kritik' | 'uyari' | 'bilgi'

export type HesaplananBildirim = {
  tur: BildirimTuru
  oncelik: BildirimOnceligi
  id: string
  baslik: string
  altBaslik: string
  tutar: number
  gunKaldi: number | null // 'butce_asildi' için gün kavramı yok
}

type BorcKaynagi = { id: string; institution_name: string; remaining_amount: number | string; due_date: string | null }
type DuzenliKaynagi = { id: string; category: string; description: string | null; amount: number | string; day_of_month: number }
type AlacakKaynagi = { id: string; contact_name: string; remaining_amount: number | string; expected_date: string | null }

// Düzenli işlemin bu ya da gelecek ayki tekrar tarihini hesaplar (BildirimZili'nden taşındı)
export function sonrakiTarihHesapla(gun: number, bugun: Date = new Date()): Date {
  const buAySonGun = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0).getDate()
  const buAyGun = Math.min(gun, buAySonGun)
  let hedef = new Date(bugun.getFullYear(), bugun.getMonth(), buAyGun)
  hedef.setHours(0, 0, 0, 0)
  const bugunSifirli = new Date(bugun)
  bugunSifirli.setHours(0, 0, 0, 0)

  if (hedef < bugunSifirli) {
    const gelecekAyYil = bugun.getMonth() === 11 ? bugun.getFullYear() + 1 : bugun.getFullYear()
    const gelecekAyAy = bugun.getMonth() === 11 ? 0 : bugun.getMonth() + 1
    const gelecekAySonGun = new Date(gelecekAyYil, gelecekAyAy + 1, 0).getDate()
    const gelecekAyGun = Math.min(gun, gelecekAySonGun)
    hedef = new Date(gelecekAyYil, gelecekAyAy, gelecekAyGun)
  }
  return hedef
}

// Tek yerde: hangi bildirim tipi hangi eşikte "kritik", hangi eşikte "uyari" olur.
const YAKLASAN_ESIK_GUN = 5
function yaklasanOncelik(gunKaldi: number): BildirimOnceligi | null {
  if (gunKaldi < 0) return 'kritik'
  if (gunKaldi <= YAKLASAN_ESIK_GUN) return 'uyari'
  return null // eşik dışı, bildirime dönüşmez
}

const ONCELIK_SIRASI: Record<BildirimOnceligi, number> = { kritik: 0, uyari: 1, bilgi: 2 }

export function bildirimleriHesapla(
  borclar: BorcKaynagi[],
  duzenliIslemler: DuzenliKaynagi[],
  alacaklar: AlacakKaynagi[],
  buAyGiderKategorileri: { kategori: string; tutar: number }[],
  harcamaLimitleri: Record<string, number>,
  bugun: Date = new Date(),
): HesaplananBildirim[] {
  const sonuc: HesaplananBildirim[] = []

  // --- Borçlar ---
  for (const b of borclar) {
    if (!b.due_date) continue
    const gunKaldi = gunKaldiHesapla(b.due_date, bugun)
    const oncelik = yaklasanOncelik(gunKaldi)
    if (!oncelik) continue
    sonuc.push({
      tur: gunKaldi < 0 ? 'borc_gecikti' : 'borc_yaklasan',
      oncelik, id: b.id, baslik: b.institution_name, altBaslik: '',
      tutar: Number(b.remaining_amount), gunKaldi,
    })
  }

  // --- Düzenli işlemler ---
  for (const r of duzenliIslemler) {
    const tarih = sonrakiTarihHesapla(r.day_of_month, bugun)
    const tarihStr = `${tarih.getFullYear()}-${ikiBasamak(tarih.getMonth() + 1)}-${ikiBasamak(tarih.getDate())}`
    const gunKaldi = gunKaldiHesapla(tarihStr, bugun)
    const oncelik = yaklasanOncelik(gunKaldi)
    if (!oncelik) continue
    sonuc.push({
      tur: 'duzenli_yaklasan', oncelik, id: r.id, baslik: r.category, altBaslik: r.description || '',
      tutar: Number(r.amount), gunKaldi,
    })
  }

  // --- Bekleyen Alacaklar ---
  for (const a of alacaklar) {
    if (!a.expected_date) continue
    const gunKaldi = gunKaldiHesapla(a.expected_date, bugun)
    const oncelik = yaklasanOncelik(gunKaldi)
    if (!oncelik) continue
    sonuc.push({
      tur: gunKaldi < 0 ? 'alacak_gecikti' : 'alacak_yaklasan',
      oncelik, id: a.id, baslik: a.contact_name, altBaslik: '',
      tutar: Number(a.remaining_amount), gunKaldi,
    })
  }

  // --- Bütçe limitleri (bu ayki net gider dağılımı, limitleri aşan kategoriler) ---
  for (const g of buAyGiderKategorileri) {
    const limit = harcamaLimitleri[g.kategori]
    if (!limit || g.tutar <= limit) continue
    sonuc.push({
      tur: 'butce_asildi', oncelik: 'kritik', id: g.kategori, baslik: g.kategori,
      altBaslik: `Limit: ${limit.toLocaleString('tr-TR')} ₺`, tutar: g.tutar - limit, gunKaldi: null,
    })
  }

  return sonuc.sort((x, y) => {
    const p = ONCELIK_SIRASI[x.oncelik] - ONCELIK_SIRASI[y.oncelik]
    if (p !== 0) return p
    return (x.gunKaldi ?? 999) - (y.gunKaldi ?? 999)
  })
}
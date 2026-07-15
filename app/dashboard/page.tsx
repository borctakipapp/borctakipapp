import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaasOnboardingBanner from '@/components/MaasOnboardingBanner'
import OzetSekmeler from '@/components/OzetSekmeler'
import {
  toplamBorcHesapla, ayKirilimiHesapla, aylikBorcYukuHesapla, borcGelirOraniHesapla,
  gecikenBorcSayisiHesapla, saglikSkoruHesapla, ayAraligiUret, ikiBasamak as ikiBasamakOz,
  netServetHesapla, gunKaldiHesapla, giderKategorileriHesapla, borcKapanmaTahminiHesapla, enYuksekFaizliBorcBul,
  toplamBirikimHesapla, toplamBekleyenAlacakHesapla, abonelikToplamiHesapla,
} from '@/lib/finans-motoru'
import { GIDER_KATEGORI_RENK as KATEGORI_RENK } from '@/lib/gider-kategorileri'

export default async function OzetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const simdi = new Date()
  const yil = simdi.getFullYear()
  const ay = simdi.getMonth()
  const { baslangic: baslangicStr, bitis: bitisStr } = ayAraligiUret(yil, ay, 0)

  // Bu ay + önceki 6 ay — tüm aylık kırılımlar (bu ay, önceki ay, streak, trend grafiği)
  // TEK bir geniş sorgudan hafızada türetilecek; sıralı (bir bekleyip diğerini atan) sorgu YOK.
  const yediAyOncekiTarih = new Date(yil, ay - 6, 1)
  const yediAyBaslangicStr = `${yediAyOncekiTarih.getFullYear()}-${ikiBasamakOz(yediAyOncekiTarih.getMonth() + 1)}-01`

  // Birbirinden bağımsız sorguları PARALEL çalıştırıyoruz (Promise.all) — sırayla değil.
  const [
    { data: profile },
    { data: debts },
    { data: hedefler },
    { data: genisTx },
    { data: kapanmisBorclar },
    { data: benimGruplarim },
    { data: receivables },
    { data: abonelikler },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('debts').select('*').eq('user_id', userId).eq('status', 'active').order('due_date', { ascending: true }),
    supabase.from('savings_goals').select('id, goal_name, current_amount, target_amount').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('transactions').select('type, category, amount, transaction_date').eq('user_id', userId).gte('transaction_date', yediAyBaslangicStr).lt('transaction_date', bitisStr),
    supabase.from('debts').select('id').eq('user_id', userId).eq('status', 'paid').limit(1),
    supabase.from('gruplar').select('id').eq('olusturan_id', userId).limit(1),
    supabase.from('receivables').select('remaining_amount, status').eq('user_id', userId).eq('status', 'pending'),
    supabase.from('recurring_items').select('id, amount, active, fatura_dongusu').eq('user_id', userId).eq('abonelik_mi', true).eq('active', true),
  ])

  const ilkIsim = profile?.full_name ? profile.full_name.split(' ')[0] : null
  // --- FİNANS MOTORU: toplam borç ---
  const toplamBorc = toplamBorcHesapla(debts || [])
  const debtIds = (debts || []).map((d) => d.id)

  // Ödemeler de aynı 7 aylık pencerede TEK sorgu (debtIds'e bağımlı olduğu için Promise.all'a alamadık ama tek sorgu)
  const { data: genisPayments } = debtIds.length > 0
    ? await supabase.from('payments').select('amount, paid_at').in('debt_id', debtIds).gte('paid_at', `${yediAyBaslangicStr}T00:00:00`)
    : { data: [] as { amount: number; paid_at: string }[] }

  // --- FİNANS MOTORU: Toplam Birikim ---
  const toplamBirikim = toplamBirikimHesapla(hedefler || [])
  // --- FİNANS MOTORU: Net Servet ---
  const netDurumGenel = netServetHesapla(toplamBirikim, toplamBorc)
  const aktifHedef = (hedefler || []).find((h) => Number(h.current_amount) < Number(h.target_amount))
  const aktifHedefOrani = aktifHedef ? Math.min(100, (Number(aktifHedef.current_amount) / Number(aktifHedef.target_amount)) * 100) : 0

  // --- FİNANS MOTORU: Borç kapanma tahmini (son 6 ay ödemesi) ---
  const tahminiAy = borcKapanmaTahminiHesapla(toplamBorc, genisPayments || [])

  // Yaklaşan ödemeler (en yakın 4 tanesi) — gün farkı artık motordan
  const bugunTarih = new Date(); bugunTarih.setHours(0, 0, 0, 0)
  const yaklasanlar = (debts || [])
    .filter((d) => d.due_date)
    .map((d) => ({ ...d, gunKaldi: gunKaldiHesapla(d.due_date, bugunTarih) }))
    .sort((a, b) => a.gunKaldi - b.gunKaldi)
    .slice(0, 4)
  const enYakinOdeme = yaklasanlar[0]

  // --- FİNANS MOTORU: geciken borç sayısı, yapısal aylık borç yükü, en yüksek faizli borç ---
  const gecikenSayisi = gecikenBorcSayisiHesapla(debts || [], bugunTarih)
  const aylikBorcYuku = aylikBorcYukuHesapla(debts || [])
  const enYuksekFaizliBorc = enYuksekFaizliBorcBul(debts || [])

  // --- FİNANS MOTORU: aylık kırılımlar (bu ay, önceki ay, streak, trend) ---
  // Not: motor, "Birikimden Çekim"i HER ayda tutarlı şekilde netliyor — önceki kodda bu netleme
  // sadece "bu ay" için yapılıyordu, streak/önceki ay hesaplarında unutulmuştu. Motora taşınca
  // bu tutarsızlık da otomatik düzeldi.
  const buAyAralik = ayAraligiUret(yil, ay, 0)
  const buAyKirilim = ayKirilimiHesapla(genisTx || [], genisPayments || [], buAyAralik.baslangic, buAyAralik.bitis)
  const buAyGelir = buAyKirilim.gelir
  const buAyManuelGider = buAyKirilim.gider
  const buAyBorcOdemesi = buAyKirilim.borcOdeme
  const buAyNet = buAyKirilim.net

  const oncekiAyAralik = ayAraligiUret(yil, ay, 1)
  const oncekiKirilim = ayKirilimiHesapla(genisTx || [], genisPayments || [], oncekiAyAralik.baslangic, oncekiAyAralik.bitis)
  const oncekiAyNet = oncekiKirilim.net
  const oncekiVeriVar = oncekiKirilim.veriVar

  const ilkBorcKapandi = (kapanmisBorclar || []).length > 0
  const ilkHedefTamamlandi = (hedefler || []).some((h) => Number(h.current_amount) >= Number(h.target_amount) && Number(h.target_amount) > 0)
  const ilkGrupKuruldu = (benimGruplarim || []).length > 0

  // Streak — sorgu atmıyor, sadece hafızadaki genisTx/genisPayments'ı Finans Motoru ile tarıyor
  let streakAySayisi = 0
  for (let i = 0; i < 6; i++) {
    const aralik = ayAraligiUret(yil, ay, i)
    const { net, veriVar } = ayKirilimiHesapla(genisTx || [], genisPayments || [], aralik.baslangic, aralik.bitis)
    if (!veriVar) break
    if (net >= 0) streakAySayisi++
    else break
  }

  // Son 6 ay ödeme trendi (grafik için)
  const AY_KISALTMALARI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  const odemeTrendi: { etiket: string; tutar: number }[] = []
  if (debtIds.length > 0) {
    for (let i = 5; i >= 0; i--) {
      const aralik = ayAraligiUret(yil, ay, i)
      const kirilim = ayKirilimiHesapla(genisTx || [], genisPayments || [], aralik.baslangic, aralik.bitis)
      odemeTrendi.push({ etiket: AY_KISALTMALARI[aralik.ayIndex], tutar: kirilim.borcOdeme })
    }
  }

  const rozetler = [
    { anahtar: 'ilk-borc', ikon: '🎉', etiket: 'İlk Borç Kapatma', kazanildi: ilkBorcKapandi },
    { anahtar: 'ilk-hedef', ikon: '🎯', etiket: 'İlk Hedef Tamamlama', kazanildi: ilkHedefTamamlandi },
    { anahtar: 'ilk-grup', ikon: '👥', etiket: 'İlk Grup Kurma', kazanildi: ilkGrupKuruldu },
    { anahtar: 'streak-3', ikon: '📈', etiket: '3 Ay Üst Üste Pozitif', kazanildi: streakAySayisi >= 3 },
  ]

  // --- FİNANS MOTORU: Borç/Gelir oranı + Finansal Sağlık Skoru ---
  const borcGelirOrani = borcGelirOraniHesapla(aylikBorcYuku, buAyGelir)
  const hicVeriYokMu = (debts || []).length === 0 && (hedefler || []).length === 0 && (genisTx || []).length === 0
  const { skor, nedenler: skorNedenleri, durum: skorDurum } = saglikSkoruHesapla({
    borcGelirOrani, gecikenSayisi, buAyNet, toplamBirikim, hicVeriYokMu,
  })

  // --- FİNANS MOTORU: gider dağılımı (Gelir-Gider sayfasıyla AYNI fonksiyon) ---
  const { liste: giderListesi, enBuyuk: enBuyukGider } = giderKategorileriHesapla(buAyKirilim.islemler, KATEGORI_RENK)

  // --- FİNANS MOTORU: Bekleyen Alacaklar (bilgi amaçlı — Net Servet'e DAHİL DEĞİL, FAZ 0.5 kararı) ---
  const toplamBekleyenAlacak = toplamBekleyenAlacakHesapla(receivables || [])

  // --- FİNANS MOTORU: Abonelikler (aylık eşdeğer toplam — Abonelikler sayfasıyla AYNI fonksiyon) ---
  const aylikAbonelikToplami = abonelikToplamiHesapla(abonelikler || [])

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-lg text-navy mb-6">Merhaba{ilkIsim ? `, ${ilkIsim}` : ''} 👋</p>

        <MaasOnboardingBanner />

        {/* Hero: toplam borç, büyük ve net */}
        <p className="text-sm text-muted mb-1">Toplam Borcun</p>
        <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
          {toplamBorc.toLocaleString('tr-TR')} ₺
        </p>
        {tahminiAy !== null && (
          <p className="text-sm text-sage font-medium mb-8">
            Borçsuz kalmana yaklaşık {tahminiAy} ay kaldı
            <span className="text-muted font-normal"> (~{tahminiAy * 30} gün)</span>
          </p>
        )}
        {tahminiAy === null && toplamBorc > 0 && (
          <p className="text-sm text-muted mb-8">Kapanma tahmini için henüz yeterli ödeme geçmişin yok</p>
        )}
        {toplamBorc === 0 && (
          <p className="text-sm text-sage font-medium mb-8">Hiç aktif borcun yok, harika durumdasın! 🎉</p>
        )}

        {/* Finansal Sağlık Skoru */}
        <div className="bg-white rounded-lg border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted uppercase tracking-wide">Finansal Sağlığın</h2>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${skorDurum.badge}`}>
              {skorDurum.etiket}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <p className={`font-mono text-3xl font-medium ${skorDurum.metin}`}>{skor}<span className="text-base text-muted"> / 100</span></p>
            <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
              <div style={{ width: `${skor}%` }} className={`h-full rounded-full ${skorDurum.cubuk}`} />
            </div>
          </div>
          {skorNedenleri.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {skorNedenleri.map((n) => (
                <li key={n} className="text-xs text-muted">• {n}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Borç Önceliklendirme, Bugün, Grafikler, Detaylar — hepsi sekmeli tek bileşende */}
        <OzetSekmeler
          enYuksekFaizliBorc={enYuksekFaizliBorc}
          enYakinOdeme={enYakinOdeme}
          buAyNet={buAyNet}
          borcGelirOrani={borcGelirOrani}
          oncekiVeriVar={oncekiVeriVar}
          oncekiAyNet={oncekiAyNet}
          streakAySayisi={streakAySayisi}
          aktifHedef={aktifHedef}
          aktifHedefOrani={aktifHedefOrani}
          odemeTrendi={odemeTrendi}
          rozetler={rozetler}
          toplamBirikim={toplamBirikim}
          netDurumGenel={netDurumGenel}
          yaklasanlar={yaklasanlar}
          giderListesi={giderListesi}
          enBuyukGider={enBuyukGider}
          toplamBekleyenAlacak={toplamBekleyenAlacak}
          aylikAbonelikToplami={aylikAbonelikToplami}
        />
      </main>
    
  )
}
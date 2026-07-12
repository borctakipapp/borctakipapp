import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaasOnboardingBanner from '@/components/MaasOnboardingBanner'
import OzetSekmeler from '@/components/OzetSekmeler'

const KATEGORI_RENK: Record<string, string> = {
  'Market/Gıda': '#B5533C', 'Ulaşım': '#D98E3F', 'Eğlence': '#7f8ba0', 'Sağlık': '#1B2A4A',
  'Giyim': '#9c7ab5', 'Eğitim': '#4A7C74', 'Kişisel Bakım': '#c98a8a', 'Birikim Aktarımı': '#4A7C74', 'Ortak Hesap': '#D9A441', 'Diğer Gider': '#6b6f7a',
}

function ikiBasamakOz(n: number) {
  return String(n).padStart(2, '0')
}

export default async function OzetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const simdi = new Date()
  const yil = simdi.getFullYear()
  const ay = simdi.getMonth()
  const baslangicStr = `${yil}-${ikiBasamakOz(ay + 1)}-01`
  const bitisYil = ay === 11 ? yil + 1 : yil
  const bitisAy = ay === 11 ? 0 : ay + 1
  const bitisStr = `${bitisYil}-${ikiBasamakOz(bitisAy + 1)}-01`

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
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('debts').select('*').eq('user_id', userId).eq('status', 'active').order('due_date', { ascending: true }),
    supabase.from('savings_goals').select('id, goal_name, current_amount, target_amount').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('transactions').select('type, category, amount, transaction_date').eq('user_id', userId).gte('transaction_date', yediAyBaslangicStr).lt('transaction_date', bitisStr),
    supabase.from('debts').select('id').eq('user_id', userId).eq('status', 'paid').limit(1),
    supabase.from('gruplar').select('id').eq('olusturan_id', userId).limit(1),
  ])

  const ilkIsim = profile?.full_name ? profile.full_name.split(' ')[0] : null
  const toplamBorc = (debts || []).reduce((sum, d) => sum + Number(d.remaining_amount), 0)
  const debtIds = (debts || []).map((d) => d.id)

  // Ödemeler de aynı 7 aylık pencerede TEK sorgu (debtIds'e bağımlı olduğu için Promise.all'a alamadık ama tek sorgu)
  const { data: genisPayments } = debtIds.length > 0
    ? await supabase.from('payments').select('amount, paid_at').in('debt_id', debtIds).gte('paid_at', `${yediAyBaslangicStr}T00:00:00`)
    : { data: [] as { amount: number; paid_at: string }[] }

  const toplamBirikim = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)
  const netDurumGenel = toplamBirikim - toplamBorc
  const aktifHedef = (hedefler || []).find((h) => Number(h.current_amount) < Number(h.target_amount))
  const aktifHedefOrani = aktifHedef ? Math.min(100, (Number(aktifHedef.current_amount) / Number(aktifHedef.target_amount)) * 100) : 0

  // Borç kapanma tahmini (son 6 ay ödemesi — genisPayments'tan türetiliyor)
  let tahminiAy: number | null = null
  if (debtIds.length > 0 && toplamBorc > 0 && genisPayments && genisPayments.length > 0) {
    const toplamOdeme = genisPayments.reduce((s, p) => s + Number(p.amount), 0)
    const aylarSet = new Set(genisPayments.map((p) => p.paid_at.slice(0, 7)))
    const ortalamaAylikOdeme = toplamOdeme / Math.max(1, aylarSet.size)
    if (ortalamaAylikOdeme > 0) tahminiAy = Math.ceil(toplamBorc / ortalamaAylikOdeme)
  }

  // Yaklaşan ödemeler (en yakın 4 tanesi)
  const bugunTarih = new Date(); bugunTarih.setHours(0, 0, 0, 0)
  const yaklasanlar = (debts || [])
    .filter((d) => d.due_date)
    .map((d) => {
      const [y, m, g] = d.due_date.split('-').map(Number)
      const t = new Date(y, m - 1, g)
      const gunKaldi = Math.round((t.getTime() - bugunTarih.getTime()) / 86400000)
      return { ...d, gunKaldi }
    })
    .sort((a, b) => a.gunKaldi - b.gunKaldi)
    .slice(0, 4)
  const enYakinOdeme = yaklasanlar[0]

  const gecikenSayisi = (debts || [])
    .filter((d) => d.due_date)
    .map((d) => {
      const [y, m, g] = d.due_date.split('-').map(Number)
      const t = new Date(y, m - 1, g)
      return Math.round((t.getTime() - bugunTarih.getTime()) / 86400000)
    })
    .filter((g) => g < 0).length

  const aylikBorcYuku = (debts || []).reduce((s, d) => {
    if (d.installment_total && d.installment_remaining) return s + (Number(d.remaining_amount) / d.installment_remaining)
    return s
  }, 0)

  const enYuksekFaizliBorc = (debts || [])
    .filter((d) => d.interest_rate && Number(d.interest_rate) > 0)
    .sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))[0]

  // --- Aylık kırılım yardımcı fonksiyonu — hafızada, sorgu ATMADAN hesaplıyor ---
  function ayAraligi(hedefAyOffset: number) {
    const tarih = new Date(yil, ay - hedefAyOffset, 1)
    const y = tarih.getFullYear(); const m = tarih.getMonth()
    const bas = `${y}-${ikiBasamakOz(m + 1)}-01`
    const bitYil = m === 11 ? y + 1 : y; const bitAy = m === 11 ? 0 : m + 1
    const bit = `${bitYil}-${ikiBasamakOz(bitAy + 1)}-01`
    return { bas, bit, ayIndex: m }
  }

  function ayKirilimi(hedefAyOffset: number) {
    const { bas, bit } = ayAraligi(hedefAyOffset)
    const txBu = (genisTx || []).filter((t) => t.transaction_date >= bas && t.transaction_date < bit)
    const gelir = txBu.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const gider = txBu.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const payBu = (genisPayments || []).filter((p) => p.paid_at >= `${bas}T00:00:00` && p.paid_at < `${bit}T00:00:00`)
    const borcOdeme = payBu.reduce((s, p) => s + Number(p.amount), 0)
    const veriVar = txBu.length > 0 || borcOdeme > 0
    return { gelir, gider, borcOdeme, net: gelir - gider - borcOdeme, veriVar, tx: txBu }
  }

  // Bu ayki gelir-gider
  const buAyKirilim = ayKirilimi(0)
  const birikimdenCekimToplamiOz = buAyKirilim.tx.filter((t) => t.type === 'income' && t.category === 'Birikimden Çekim').reduce((s, t) => s + Number(t.amount), 0)
  const buAyGelir = buAyKirilim.gelir - birikimdenCekimToplamiOz
  const buAyManuelGider = buAyKirilim.gider - birikimdenCekimToplamiOz
  const buAyBorcOdemesi = buAyKirilim.borcOdeme
  const buAyNet = buAyGelir - buAyManuelGider - buAyBorcOdemesi

  // Geçen ay
  const oncekiKirilim = ayKirilimi(1)
  const oncekiAyNet = oncekiKirilim.net
  const oncekiVeriVar = oncekiKirilim.veriVar

  const ilkBorcKapandi = (kapanmisBorclar || []).length > 0
  const ilkHedefTamamlandi = (hedefler || []).some((h) => Number(h.current_amount) >= Number(h.target_amount) && Number(h.target_amount) > 0)
  const ilkGrupKuruldu = (benimGruplarim || []).length > 0

  // Streak — artık sorgu atmıyor, sadece hafızadaki genisTx/genisPayments'ı tarıyor
  let streakAySayisi = 0
  for (let i = 0; i < 6; i++) {
    const { net, veriVar } = ayKirilimi(i)
    if (!veriVar) break
    if (net >= 0) streakAySayisi++
    else break
  }

  // Son 6 ay ödeme trendi (grafik için) — yine hafızadan
  const AY_KISALTMALARI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  const odemeTrendi: { etiket: string; tutar: number }[] = []
  if (debtIds.length > 0) {
    for (let i = 5; i >= 0; i--) {
      const { ayIndex } = ayAraligi(i)
      odemeTrendi.push({ etiket: AY_KISALTMALARI[ayIndex], tutar: ayKirilimi(i).borcOdeme })
    }
  }

  const rozetler = [
    { anahtar: 'ilk-borc', ikon: '🎉', etiket: 'İlk Borç Kapatma', kazanildi: ilkBorcKapandi },
    { anahtar: 'ilk-hedef', ikon: '🎯', etiket: 'İlk Hedef Tamamlama', kazanildi: ilkHedefTamamlandi },
    { anahtar: 'ilk-grup', ikon: '👥', etiket: 'İlk Grup Kurma', kazanildi: ilkGrupKuruldu },
    { anahtar: 'streak-3', ikon: '📈', etiket: '3 Ay Üst Üste Pozitif', kazanildi: streakAySayisi >= 3 },
  ]

  // Finansal Sağlık Skoru (0-100)
  const borcGelirOrani = buAyGelir > 0 ? aylikBorcYuku / buAyGelir : null
  const skorNedenleri: string[] = []
  let skor = 0

  if (borcGelirOrani === null) {
    skor += 20
  } else if (borcGelirOrani <= 0.20) {
    skor += 40
  } else if (borcGelirOrani <= 0.35) {
    skor += 28
    skorNedenleri.push('Borç/gelir oranın orta seviyede — takipte tut')
  } else if (borcGelirOrani <= 0.50) {
    skor += 12
    skorNedenleri.push('Borç/gelir oranını azaltmaya odaklanmak iyi olur')
  } else {
    skorNedenleri.push('Borç yükün gelirine göre ağır — önceliğin borcu azaltmak olabilir')
  }

  if (gecikenSayisi === 0) {
    skor += 25
  } else {
    skorNedenleri.push(`${gecikenSayisi} borcun gecikmiş — bugün bir göz atmaya değer`)
  }

  if (buAyNet >= 0) {
    skor += 20
  } else {
    skorNedenleri.push('Bu ay gider gelirden fazla oldu — geçici bir dalgalanma olabilir')
  }

  if (toplamBirikim > 0) {
    skor += 15
  } else {
    skorNedenleri.push('Küçük bir birikim hedefi koymak iyi bir başlangıç olur')
  }

  skor = Math.max(0, Math.min(100, skor))
  // Tailwind class'ları TAM/sabit string olarak yazılmalı (dinamik `bg-${x}-soft` derleme zamanında tanınmaz)
  const skorDurum = skor >= 70
    ? { etiket: 'İyi', badge: 'bg-sage-soft text-sage', metin: 'text-sage', cubuk: 'bg-sage' }
    : skor >= 40
      ? { etiket: 'Orta', badge: 'bg-amber-soft text-amber', metin: 'text-amber', cubuk: 'bg-amber' }
      : { etiket: 'Gelişim Alanı', badge: 'bg-brick-soft text-brick', metin: 'text-brick', cubuk: 'bg-brick' }

  // Gider dağılımı (mini) — bu ayki kırılımdan
  const giderMap: Record<string, number> = {}
  buAyKirilim.tx.filter((t) => t.type === 'expense').forEach((t) => {
    giderMap[t.category] = (giderMap[t.category] || 0) + Number(t.amount)
  })
  if (birikimdenCekimToplamiOz > 0 && giderMap['Birikim Aktarımı']) {
    giderMap['Birikim Aktarımı'] = Math.max(0, giderMap['Birikim Aktarımı'] - birikimdenCekimToplamiOz)
  }
  const giderListesi = Object.entries(giderMap)
    .filter(([, tutar]) => tutar > 0)
    .map(([kategori, tutar]) => ({ kategori, tutar, renk: KATEGORI_RENK[kategori] || '#6b6f7a' }))
    .sort((a, b) => b.tutar - a.tutar)
    .slice(0, 5)
  const enBuyukGider = Math.max(...giderListesi.map((g) => g.tutar), 1)

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
        />
      </main>
    
  )
}
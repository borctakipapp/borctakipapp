import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppSayfaDuzeni from '@/components/AppSayfaDuzeni'
import MaasOnboardingBanner from '@/components/MaasOnboardingBanner'

const KATEGORI_RENK: Record<string, string> = {
  'Market/Gıda': '#B5533C', 'Ulaşım': '#D98E3F', 'Eğlence': '#7f8ba0', 'Sağlık': '#1B2A4A',
  'Giyim': '#9c7ab5', 'Eğitim': '#4A7C74', 'Kişisel Bakım': '#c98a8a', 'Birikim Aktarımı': '#4A7C74', 'Diğer Gider': '#6b6f7a',
}

function ikiBasamakOz(n: number) {
  return String(n).padStart(2, '0')
}

export default async function OzetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const simdi = new Date()
  const yil = simdi.getFullYear()
  const ay = simdi.getMonth()
  const baslangicStr = `${yil}-${ikiBasamakOz(ay + 1)}-01`
  const bitisYil = ay === 11 ? yil + 1 : yil
  const bitisAy = ay === 11 ? 0 : ay + 1
  const bitisStr = `${bitisYil}-${ikiBasamakOz(bitisAy + 1)}-01`

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const ilkIsim = profile?.full_name ? profile.full_name.split(' ')[0] : null

  // Borçlar
  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('due_date', { ascending: true })

  const toplamBorc = (debts || []).reduce((sum, d) => sum + Number(d.remaining_amount), 0)
  const debtIds = (debts || []).map((d) => d.id)

  const { data: hedefler } = await supabase
    .from('savings_goals')
    .select('id, goal_name, current_amount, target_amount')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const toplamBirikim = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)
  const netDurumGenel = toplamBirikim - toplamBorc
  const aktifHedef = (hedefler || []).find((h) => Number(h.current_amount) < Number(h.target_amount))
  const aktifHedefOrani = aktifHedef ? Math.min(100, (Number(aktifHedef.current_amount) / Number(aktifHedef.target_amount)) * 100) : 0

  // Borç kapanma tahmini (son 6 ay)
  const altiAyOnce = new Date()
  altiAyOnce.setMonth(altiAyOnce.getMonth() - 6)
  let tahminiAy: number | null = null

  if (debtIds.length > 0 && toplamBorc > 0) {
    const { data: sonAltiAyOdemeler } = await supabase
      .from('payments')
      .select('amount, paid_at')
      .in('debt_id', debtIds)
      .gte('paid_at', altiAyOnce.toISOString())

    if (sonAltiAyOdemeler && sonAltiAyOdemeler.length > 0) {
      const toplamOdeme = sonAltiAyOdemeler.reduce((s, p) => s + Number(p.amount), 0)
      const aylarSet = new Set(sonAltiAyOdemeler.map((p) => p.paid_at.slice(0, 7)))
      const ortalamaAylikOdeme = toplamOdeme / aylarSet.size
      if (ortalamaAylikOdeme > 0) tahminiAy = Math.ceil(toplamBorc / ortalamaAylikOdeme)
    }
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

  // Tüm borçlar için gecikme durumu (Finansal Sağlık Skoru için — sadece ilk 4'e değil, hepsine bakıyoruz)
  const tumGunFarklari = (debts || [])
    .filter((d) => d.due_date)
    .map((d) => {
      const [y, m, g] = d.due_date.split('-').map(Number)
      const t = new Date(y, m - 1, g)
      return Math.round((t.getTime() - bugunTarih.getTime()) / 86400000)
    })
  const gecikenSayisi = tumGunFarklari.filter((g) => g < 0).length

  // Yapısal aylık borç yükü (taksitli borçların güncel taksit tutarları toplamı — o ay ödenmiş olsun olmasın)
  const aylikBorcYuku = (debts || []).reduce((s, d) => {
    if (d.installment_total && d.installment_remaining) {
      return s + (Number(d.remaining_amount) / d.installment_remaining)
    }
    return s
  }, 0)

  // En yüksek faizli borç (önceliklendirme önerisi için)
  const enYuksekFaizliBorc = (debts || [])
    .filter((d) => d.interest_rate && Number(d.interest_rate) > 0)
    .sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))[0]

  // Bu ayki gelir-gider
  const { data: buAyTx } = await supabase
    .from('transactions')
    .select('type, category, amount')
    .eq('user_id', user.id)
    .gte('transaction_date', baslangicStr)
    .lt('transaction_date', bitisStr)

  // "Birikimden Çekim" gerçek bir gelir değil — Gelir-Gider sayfasındaki mantıkla tutarlı olsun diye burada da netliyoruz.
  const birikimdenCekimToplamiOz = (buAyTx || []).filter((t) => t.type === 'income' && t.category === 'Birikimden Çekim').reduce((s, t) => s + Number(t.amount), 0)
  const buAyGelir = (buAyTx || []).filter((t) => t.type === 'income' && t.category !== 'Birikimden Çekim').reduce((s, t) => s + Number(t.amount), 0)
  const buAyManuelGider = (buAyTx || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekimToplamiOz

  let buAyBorcOdemesi = 0
  if (debtIds.length > 0) {
    const { data: buAyOdemeler } = await supabase
      .from('payments')
      .select('amount')
      .in('debt_id', debtIds)
      .gte('paid_at', `${baslangicStr}T00:00:00`)
      .lt('paid_at', `${bitisStr}T00:00:00`)
    buAyBorcOdemesi = (buAyOdemeler || []).reduce((s, p) => s + Number(p.amount), 0)
  }

  const buAyNet = buAyGelir - buAyManuelGider - buAyBorcOdemesi

  // Geçen aya göre trend (basitleştirilmiş, birikim netlemesi olmadan — sadece yön göstergesi)
  const oncekiAyTarih = new Date(yil, ay - 1, 1)
  const oncekiYil = oncekiAyTarih.getFullYear()
  const oncekiAy = oncekiAyTarih.getMonth()
  const oncekiBaslangicStr = `${oncekiYil}-${ikiBasamakOz(oncekiAy + 1)}-01`

  const { data: oncekiAyTx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', user.id)
    .gte('transaction_date', oncekiBaslangicStr)
    .lt('transaction_date', baslangicStr)

  const oncekiGelir = (oncekiAyTx || []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const oncekiGider = (oncekiAyTx || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  let oncekiBorcOdemesi = 0
  if (debtIds.length > 0) {
    const { data: oncekiOdemeler } = await supabase
      .from('payments')
      .select('amount')
      .in('debt_id', debtIds)
      .gte('paid_at', `${oncekiBaslangicStr}T00:00:00`)
      .lt('paid_at', `${baslangicStr}T00:00:00`)
    oncekiBorcOdemesi = (oncekiOdemeler || []).reduce((s, p) => s + Number(p.amount), 0)
  }

  const oncekiAyNet = oncekiGelir - oncekiGider - oncekiBorcOdemesi
  const oncekiVeriVar = (oncekiAyTx && oncekiAyTx.length > 0) || oncekiBorcOdemesi > 0

  // Rozetler (küçük başarılar) — mevcut veriden hesaplanıyor, ayrı bir tablo gerekmiyor
  const { data: kapanmisBorclar } = await supabase.from('debts').select('id').eq('user_id', user.id).eq('status', 'paid').limit(1)
  const ilkBorcKapandi = (kapanmisBorclar || []).length > 0

  const ilkHedefTamamlandi = (hedefler || []).some((h) => Number(h.current_amount) >= Number(h.target_amount) && Number(h.target_amount) > 0)

  const { data: benimGruplarim } = await supabase.from('gruplar').select('id').eq('olusturan_id', user.id).limit(1)
  const ilkGrupKuruldu = (benimGruplarim || []).length > 0

  // Streak: son 3 ay üst üste net pozitif miydi (basitleştirilmiş, gerçek zamanında ödeme takibi değil — elimizdeki veriyle en dürüst hesaplama bu)
  async function ayNetiHesapla(hedefAyOffset: number) {
    const tarih = new Date(yil, ay - hedefAyOffset, 1)
    const y = tarih.getFullYear()
    const m = tarih.getMonth()
    const bas = `${y}-${ikiBasamakOz(m + 1)}-01`
    const bitYil = m === 11 ? y + 1 : y
    const bitAy = m === 11 ? 0 : m + 1
    const bit = `${bitYil}-${ikiBasamakOz(bitAy + 1)}-01`

    const { data: tx } = await supabase.from('transactions').select('type, amount').eq('user_id', user.id).gte('transaction_date', bas).lt('transaction_date', bit)
    const gelir = (tx || []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const gider = (tx || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    let borcOdeme = 0
    if (debtIds.length > 0) {
      const { data: pay } = await supabase.from('payments').select('amount').in('debt_id', debtIds).gte('paid_at', `${bas}T00:00:00`).lt('paid_at', `${bit}T00:00:00`)
      borcOdeme = (pay || []).reduce((s, p) => s + Number(p.amount), 0)
    }
    const veriVar = (tx && tx.length > 0) || borcOdeme > 0
    return { net: gelir - gider - borcOdeme, veriVar }
  }

  let streakAySayisi = 0
  for (let i = 0; i < 6; i++) {
    const { net, veriVar } = await ayNetiHesapla(i)
    if (!veriVar) break
    if (net >= 0) streakAySayisi++
    else break
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
    skorNedenleri.push('Borç/gelir oranın orta seviyede')
  } else if (borcGelirOrani <= 0.50) {
    skor += 12
    skorNedenleri.push('Borç/gelir oranın yüksek')
  } else {
    skorNedenleri.push('Gelirinin yarısından fazlası borca gidiyor')
  }

  if (gecikenSayisi === 0) {
    skor += 25
  } else {
    skorNedenleri.push(`${gecikenSayisi} borcun gecikmiş durumda`)
  }

  if (buAyNet >= 0) {
    skor += 20
  } else {
    skorNedenleri.push('Bu ay giderin gelirini aştı')
  }

  if (toplamBirikim > 0) {
    skor += 15
  } else {
    skorNedenleri.push('Henüz bir birikimin yok')
  }

  skor = Math.max(0, Math.min(100, skor))
  // Tailwind class'ları TAM/sabit string olarak yazılmalı (dinamik `bg-${x}-soft` derleme zamanında tanınmaz)
  const skorDurum = skor >= 70
    ? { etiket: 'İyi', badge: 'bg-sage-soft text-sage', metin: 'text-sage', cubuk: 'bg-sage' }
    : skor >= 40
      ? { etiket: 'Orta', badge: 'bg-amber-soft text-amber', metin: 'text-amber', cubuk: 'bg-amber' }
      : { etiket: 'Dikkat', badge: 'bg-brick-soft text-brick', metin: 'text-brick', cubuk: 'bg-brick' }

  // Gider dağılımı (mini)
  const giderMap: Record<string, number> = {}
  ;(buAyTx || []).filter((t) => t.type === 'expense').forEach((t) => {
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
    <AppSayfaDuzeni aktif="ozet">
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

        {/* Borç Önceliklendirme */}
        {enYuksekFaizliBorc && (
          <Link
            href={`/dashboard/borc/${enYuksekFaizliBorc.id}`}
            className="block bg-white rounded-lg border border-border p-5 mb-8 hover:shadow-sm transition-shadow"
          >
            <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Öncelik Önerisi</h2>
            <p className="text-sm text-navy">
              Önce <b>{enYuksekFaizliBorc.institution_name}</b> borcuna odaklan — faiz oranı (%{Number(enYuksekFaizliBorc.interest_rate).toLocaleString('tr-TR')}) diğerlerinden yüksek, erken kapatman en çok burada tasarruf sağlar.
            </p>
          </Link>
        )}

        {/* "Bugün" — bağlamsal, konuşma diliyle özet */}
        <div className="bg-white rounded-lg border border-border p-5 mb-8 flex flex-col gap-3">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wide">Bugün</h2>

          {enYakinOdeme && (
            <Link href={`/dashboard/borc/${enYakinOdeme.id}`} className="flex items-start gap-2.5 hover:opacity-80 transition-opacity">
              <span className="text-lg leading-none">💳</span>
              <p className="text-sm text-navy">
                {enYakinOdeme.gunKaldi < 0 && <><b>{enYakinOdeme.institution_name}</b> ödemesi {Math.abs(enYakinOdeme.gunKaldi)} gün gecikti.</>}
                {enYakinOdeme.gunKaldi === 0 && <><b>{enYakinOdeme.institution_name}</b> için bugün son gün.</>}
                {enYakinOdeme.gunKaldi > 0 && <>{enYakinOdeme.gunKaldi} gün sonra <b>{enYakinOdeme.institution_name}</b> ödemen var — {Number(enYakinOdeme.remaining_amount).toLocaleString('tr-TR')} ₺</>}
              </p>
            </Link>
          )}

          <Link href="/dashboard/gelir-gider" className="flex items-start gap-2.5 hover:opacity-80 transition-opacity">
            <span className="text-lg leading-none">💰</span>
            <p className="text-sm text-navy">
              Bu ay elinde kalan: <b className="font-mono">{buAyNet.toLocaleString('tr-TR')} ₺</b>
            </p>
          </Link>

          {borcGelirOrani !== null && borcGelirOrani > 0.5 && (
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none">⚠️</span>
              <p className="text-sm text-brick">
                Gelirinin yaklaşık %{Math.round(borcGelirOrani * 100)}'i borca gidiyor — dikkatli ol.
              </p>
            </div>
          )}

          {oncekiVeriVar && (
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none">📉</span>
              {buAyNet >= oncekiAyNet ? (
                <p className="text-sm text-navy">
                  Bu ay geçen aya göre net durumun <b className="text-sage">iyileşti</b>
                </p>
              ) : (
                <p className="text-sm text-navy">
                  Bu ay geçen aya göre net durumun <b className="text-brick">zayıfladı</b>
                </p>
              )}
            </div>
          )}

          {streakAySayisi >= 2 && (
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none">🔥</span>
              <p className="text-sm text-navy">
                <b className="text-sage">{streakAySayisi} ay üst üste</b> net pozitiftesin, harika gidiyor
              </p>
            </div>
          )}

          {aktifHedef && (
            <Link href={`/dashboard/birikim/${aktifHedef.id}`} className="flex items-start gap-2.5 hover:opacity-80 transition-opacity">
              <span className="text-lg leading-none">🎯</span>
              <p className="text-sm text-navy">
                <b>{aktifHedef.goal_name}</b> hedefinde %{aktifHedefOrani.toFixed(0)} yoldasın
              </p>
            </Link>
          )}

          {!enYakinOdeme && !aktifHedef && (
            <p className="text-sm text-muted">Şu an takip edilecek yaklaşan bir şey yok — güzel bir gün!</p>
          )}
        </div>

        {/* Rozetler */}
        <h2 className="text-sm font-medium text-muted mb-3">Başarılarım</h2>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {rozetler.map((r) => (
            <div
              key={r.anahtar}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center ${
                r.kazanildi ? 'bg-sage-soft border-sage' : 'bg-white border-border opacity-40'
              }`}
            >
              <span className="text-xl">{r.ikon}</span>
              <span className="text-[10px] text-navy leading-tight">{r.etiket}</span>
            </div>
          ))}
        </div>

        {/* İkincil rakamlar — sade, beyaz kartlar */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/dashboard/birikim" className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow">
            <p className="text-xs text-muted mb-1">Toplam Birikim</p>
            <p className="font-mono text-lg text-navy font-medium">{toplamBirikim.toLocaleString('tr-TR')} ₺</p>
          </Link>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Net Varlık</p>
            <p className={`font-mono text-lg font-medium ${netDurumGenel >= 0 ? 'text-navy' : 'text-brick'}`}>{netDurumGenel.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">
          Yaklaşan Ödemeler {yaklasanlar.length > 0 && <span className="text-muted/60">({yaklasanlar.length})</span>}
        </h2>
        {yaklasanlar.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border mb-8">Yaklaşan bir ödemen yok.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-8">
            {yaklasanlar.map((y) => {
              const renk = y.gunKaldi <= 0 ? 'border-brick' : y.gunKaldi <= 5 ? 'border-amber' : 'border-sage'
              const etiket = y.gunKaldi < 0 ? `${Math.abs(y.gunKaldi)} gün gecikti` : y.gunKaldi === 0 ? 'Bugün son gün' : `${y.gunKaldi} gün kaldı`
              return (
                <Link key={y.id} href={`/dashboard/borc/${y.id}`} className={`bg-white rounded-lg pl-4 pr-4 py-3 flex items-center justify-between border-l-4 ${renk} hover:shadow-sm transition-shadow`}>
                  <div>
                    <p className="font-medium text-navy text-sm">{y.institution_name}</p>
                    <p className="text-xs text-muted mt-0.5">{etiket}</p>
                  </div>
                  <span className="font-mono text-navy text-sm">{Number(y.remaining_amount).toLocaleString('tr-TR')} ₺</span>
                </Link>
              )
            })}
          </div>
        )}

        {giderListesi.length > 0 && (
          <details>
            <summary className="text-sm font-medium text-muted cursor-pointer mb-3">Bu Ayki Gider Dağılımı</summary>
            <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5 mt-2">
              {giderListesi.map((g) => (
                <div key={g.kategori} className="flex items-center gap-3">
                  <span className="text-xs text-navy w-28 shrink-0 truncate">{g.kategori}</span>
                  <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                    <div style={{ width: `${(g.tutar / enBuyukGider) * 100}%`, backgroundColor: g.renk }} className="h-full rounded-full" />
                  </div>
                  <span className="font-mono text-xs text-muted w-20 text-right shrink-0">{g.tutar.toLocaleString('tr-TR')} ₺</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </AppSayfaDuzeni>
  )
}

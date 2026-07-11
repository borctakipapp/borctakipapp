import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppHeader from '@/components/AppHeader'
import AltNavigasyon from '@/components/AltNavigasyon'
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

  // Bu ayki gelir-gider
  const { data: buAyTx } = await supabase
    .from('transactions')
    .select('type, category, amount')
    .eq('user_id', user.id)
    .gte('transaction_date', baslangicStr)
    .lt('transaction_date', bitisStr)

  const buAyGelir = (buAyTx || []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const buAyManuelGider = (buAyTx || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

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

  // Gider dağılımı (mini)
  const giderMap: Record<string, number> = {}
  ;(buAyTx || []).filter((t) => t.type === 'expense').forEach((t) => {
    giderMap[t.category] = (giderMap[t.category] || 0) + Number(t.amount)
  })
  const giderListesi = Object.entries(giderMap)
    .map(([kategori, tutar]) => ({ kategori, tutar, renk: KATEGORI_RENK[kategori] || '#6b6f7a' }))
    .sort((a, b) => b.tutar - a.tutar)
    .slice(0, 5)
  const enBuyukGider = Math.max(...giderListesi.map((g) => g.tutar), 1)

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader aktif="ozet" />
<main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-lg text-navy mb-6">Merhaba{ilkIsim ? `, ${ilkIsim}` : ''} 👋</p>

        <MaasOnboardingBanner />

        {/* Hero: toplam borç, büyük ve net */}
        <p className="text-sm text-muted mb-1">Toplam Borcun</p>
        <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
          {toplamBorc.toLocaleString('tr-TR')} ₺
        </p>
        {tahminiAy !== null && (
          <p className="text-sm text-sage font-medium mb-8">Borçsuz kalmana yaklaşık {tahminiAy} ay kaldı</p>
        )}
        {tahminiAy === null && toplamBorc > 0 && (
          <p className="text-sm text-muted mb-8">Kapanma tahmini için henüz yeterli ödeme geçmişin yok</p>
        )}
        {toplamBorc === 0 && (
          <p className="text-sm text-sage font-medium mb-8">Hiç aktif borcun yok, harika durumdasın! 🎉</p>
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

      <AltNavigasyon aktif="ozet" />
    </div>
  )
}
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BildirimZili from '@/components/BildirimZili'
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
  const bugunStr = `${yil}-${ikiBasamakOz(ay + 1)}-${ikiBasamakOz(simdi.getDate())}`

  // Borçlar
  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('due_date', { ascending: true })

  const toplamBorc = (debts || []).reduce((sum, d) => sum + Number(d.remaining_amount), 0)
  const debtIds = (debts || []).map((d) => d.id)

  const { data: hedefler } = await supabase.from('savings_goals').select('current_amount').eq('user_id', user.id)
  const toplamBirikim = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)
  const netDurumGenel = toplamBirikim - toplamBorc

  // Borç kapanma tahmini (son 6 ay)
  const altiAyOnce = new Date()
  altiAyOnce.setMonth(altiAyOnce.getMonth() - 6)
  let tahminiAy: number | null = null
  let ortalamaAylikOdeme = 0

  if (debtIds.length > 0 && toplamBorc > 0) {
    const { data: sonAltiAyOdemeler } = await supabase
      .from('payments')
      .select('amount, paid_at')
      .in('debt_id', debtIds)
      .gte('paid_at', altiAyOnce.toISOString())

    if (sonAltiAyOdemeler && sonAltiAyOdemeler.length > 0) {
      const toplamOdeme = sonAltiAyOdemeler.reduce((s, p) => s + Number(p.amount), 0)
      const aylarSet = new Set(sonAltiAyOdemeler.map((p) => p.paid_at.slice(0, 7)))
      ortalamaAylikOdeme = toplamOdeme / aylarSet.size
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

  // Bu ayki gelir-gider (basit özet — devreden bakiye dahil değil, tam detay Gelir-Gider sayfasında)
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
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp</span>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profil" className="text-paper/80 hover:text-paper p-1.5" aria-label="Profilim">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <BildirimZili />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
              Çıkış Yap
            </button>
          </form>
        </div>
      </header>

      <nav className="bg-navy-light px-6 py-2 flex gap-4">
        <span className="text-paper text-sm font-medium border-b-2 border-paper pb-1">Özet</span>
        <Link href="/dashboard/borclar" className="text-paper/60 hover:text-paper text-sm pb-1">Borçlar</Link>
        <Link href="/dashboard/gelir-gider" className="text-paper/60 hover:text-paper text-sm pb-1">Gelir-Gider</Link>
        <Link href="/dashboard/birikim" className="text-paper/60 hover:text-paper text-sm pb-1">Birikim</Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-sm text-muted mb-6">{user.email}</p>

        <MaasOnboardingBanner />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Link href="/dashboard/borclar" className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow">
            <p className="text-xs text-muted mb-1">Toplam Borç</p>
            <p className="font-mono text-xl text-navy font-medium">{toplamBorc.toLocaleString('tr-TR')} ₺</p>
          </Link>
          <Link href="/dashboard/birikim" className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow">
            <p className="text-xs text-muted mb-1">Toplam Birikim</p>
            <p className="font-mono text-xl text-sage font-medium">{toplamBirikim.toLocaleString('tr-TR')} ₺</p>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Link href="/dashboard/gelir-gider" className={`rounded-lg p-4 border hover:shadow-sm transition-shadow ${buAyNet >= 0 ? 'bg-sage-soft border-sage' : 'bg-brick-soft border-brick'}`}>
            <p className="text-xs text-muted mb-1">Bu Ay Net</p>
            <p className={`font-mono text-xl font-medium ${buAyNet >= 0 ? 'text-sage' : 'text-brick'}`}>{buAyNet.toLocaleString('tr-TR')} ₺</p>
          </Link>
          <div className={`rounded-lg p-4 border ${netDurumGenel >= 0 ? 'bg-sage-soft border-sage' : 'bg-brick-soft border-brick'}`}>
            <p className="text-xs text-muted mb-1">Net Varlık (Birikim − Borç)</p>
            <p className={`font-mono text-xl font-medium ${netDurumGenel >= 0 ? 'text-sage' : 'text-brick'}`}>{netDurumGenel.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        {tahminiAy !== null && (
          <p className="text-xs text-muted mb-6">
            Son 6 aydaki temponla, <span className="text-sage font-medium">yaklaşık {tahminiAy} ay sonra</span> borçsuz olursun.
          </p>
        )}
        {tahminiAy === null && toplamBorc > 0 && (
          <p className="text-xs text-muted mb-6">Kapanma tahmini için henüz yeterli ödeme geçmişin yok.</p>
        )}
        {toplamBorc === 0 && (
          <p className="text-xs text-sage mb-6">Hiç aktif borcun yok, harika durumdasın! 🎉</p>
        )}

        <h2 className="text-sm font-medium text-muted mb-3">Yaklaşan Ödemeler</h2>
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
          <>
            <h2 className="text-sm font-medium text-muted mb-3">Bu Ayki Gider Dağılımı</h2>
            <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5">
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
          </>
        )}
      </main>
    </div>
  )
}
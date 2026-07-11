import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BildirimZili from '@/components/BildirimZili'

export default async function BirikimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hedefler } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const toplamBiriken = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)

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
        <Link href="/dashboard" className="text-paper/60 hover:text-paper text-sm pb-1">Özet</Link>
        <Link href="/dashboard/borclar" className="text-paper/60 hover:text-paper text-sm pb-1">Borçlar</Link>
        <Link href="/dashboard/gelir-gider" className="text-paper/60 hover:text-paper text-sm pb-1">Gelir-Gider</Link>
        <span className="text-paper text-sm font-medium border-b-2 border-paper pb-1">Birikim</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-sm text-muted mb-1">Toplam birikiminiz</p>
        <p className="font-mono text-4xl font-medium text-sage tracking-tight mb-6">
          {toplamBiriken.toLocaleString('tr-TR')} ₺
        </p>

        <Link
          href="/dashboard/birikim/ekle"
          className="inline-block mb-8 bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Yeni Hedef Ekle
        </Link>

        <h2 className="text-sm font-medium text-muted mb-3">Hedefleriniz</h2>

        {(!hedefler || hedefler.length === 0) && (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz bir birikim hedefi eklemedin. "Tatil", "Acil durum fonu" gibi bir hedef koyup takip edebilirsin.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {hedefler?.map((h) => {
            const oran = Math.min(100, (Number(h.current_amount) / Number(h.target_amount)) * 100)
            const tamamlandi = Number(h.current_amount) >= Number(h.target_amount)
            return (
              <Link
                key={h.id}
                href={`/dashboard/birikim/${h.id}`}
                className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow block"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-navy text-sm">
                    {h.goal_name}
                    {tamamlandi && <span className="ml-1.5 text-[10px] text-sage">✓ Tamamlandı</span>}
                  </p>
                  <span className="font-mono text-xs text-muted">
                    {Number(h.current_amount).toLocaleString('tr-TR')} / {Number(h.target_amount).toLocaleString('tr-TR')} ₺
                  </span>
                </div>
                <div className="h-2 bg-paper rounded-full overflow-hidden">
                  <div
                    style={{ width: `${oran}%` }}
                    className={`h-full rounded-full ${tamamlandi ? 'bg-sage' : 'bg-amber'}`}
                  />
                </div>
                {h.target_date && (
                  <p className="text-[11px] text-muted mt-1.5">
                    Hedef tarih: {new Date(h.target_date).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
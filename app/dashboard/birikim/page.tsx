import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Monogram from '@/components/Monogram'
import BirikimEkleModal from '@/components/BirikimEkleModal'
import BirikimHedefModal from '@/components/BirikimHedefModal'
import { toplamBirikimHesapla } from '@/lib/finans-motoru'

export default async function BirikimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: hedefler } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const toplamBiriken = toplamBirikimHesapla(hedefler || [])

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-sm text-muted mb-1">Toplam Birikimin</p>
        <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
          {toplamBiriken.toLocaleString('tr-TR')} ₺
        </p>
        <p className="text-sm text-muted mb-6">
          {hedefler && hedefler.length > 0 ? `${hedefler.length} hedef üzerinde çalışıyorsun.` : 'Henüz bir hedefin yok.'}
        </p>

        <div className="mb-8">
          <BirikimEkleModal />
        </div>

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
              <BirikimHedefModal
                key={h.id}
                goalId={h.id}
                tetikleyici={
                  <div className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Monogram isim={h.goal_name} boyut={34} />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <p className="font-medium text-navy text-sm truncate">
                          {h.goal_name}
                          {tamamlandi && <span className="ml-1.5 text-[10px] text-sage">✓ Tamamlandı</span>}
                        </p>
                        <span className="font-mono text-xs text-muted shrink-0">
                          {Number(h.current_amount).toLocaleString('tr-TR')} / {Number(h.target_amount).toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
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
                  </div>
                }
              />
            )
          })}
        </div>
      </main>
    
  )
}

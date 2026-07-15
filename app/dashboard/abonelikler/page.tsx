import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { abonelikToplamiHesapla, sonrakiTarihHesapla, gunKaldiHesapla, ikiBasamak } from '@/lib/finans-motoru'
import AbonelikEkleModal from '@/components/AbonelikEkleModal'
import AbonelikDetayModal, { type Abonelik } from '@/components/AbonelikDetayModal'
import Monogram from '@/components/Monogram'

const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default async function AbonelikelerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('recurring_items')
    .select('id, saglayici_adi, category, amount, day_of_month, fatura_dongusu, fatura_ay, iptal_hatirlatma_gun, active')
    .eq('user_id', user.id)
    .eq('abonelik_mi', true)
    .order('active', { ascending: false })
    .order('day_of_month', { ascending: true })

  const abonelikler: Abonelik[] = (data || []).map((a) => ({ ...a, amount: Number(a.amount) }))
  const aylikToplam = abonelikToplamiHesapla(abonelikler)

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <p className="text-sm text-muted mb-1">Aylık Eşdeğer Abonelik Gideri</p>
      <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
        {aylikToplam.toLocaleString('tr-TR')} ₺
      </p>
      <p className="text-sm text-muted mb-8">
        {abonelikler.filter((a) => a.active).length === 0
          ? 'Henüz aktif bir abonelik eklemedin'
          : 'Yıllık abonelikler 12\'ye bölünerek aylık eşdeğere çevrildi'}
      </p>

      <div className="mb-8">
        <AbonelikEkleModal />
      </div>

      {abonelikler.length === 0 ? (
        <p className="text-muted text-sm bg-white border border-border rounded-lg p-4">
          Henüz abonelik eklemedin.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {abonelikler.map((a) => {
            const isim = a.saglayici_adi || a.category
            const tarih = sonrakiTarihHesapla(a.day_of_month, bugun, a.fatura_dongusu, a.fatura_ay)
            const tarihStr = `${tarih.getFullYear()}-${ikiBasamak(tarih.getMonth() + 1)}-${ikiBasamak(tarih.getDate())}`
            const gunKaldi = gunKaldiHesapla(tarihStr, bugun)
            const tetikleyici = (
              <div className={`bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center gap-3 cursor-pointer ${!a.active ? 'opacity-50' : ''}`}>
                <Monogram isim={isim} boyut={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm truncate" title={isim}>{isim}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {a.fatura_dongusu === 'yillik' ? `Yıllık · ${AY_ISIMLERI[(a.fatura_ay || 1) - 1]}` : 'Aylık'}
                    {a.active && gunKaldi >= 0 && gunKaldi <= (a.iptal_hatirlatma_gun ?? 5) && (
                      <span className="text-amber"> · {gunKaldi === 0 ? 'bugün' : `${gunKaldi} gün kaldı`}</span>
                    )}
                    {a.active && gunKaldi < 0 && <span className="text-brick"> · gecikti</span>}
                  </p>
                </div>
                <p className="font-mono text-sm text-navy shrink-0">{a.amount.toLocaleString('tr-TR')} ₺</p>
              </div>
            )
            return <AbonelikDetayModal key={a.id} abonelik={a} tetikleyici={tetikleyici} />
          })}
        </div>
      )}
    </main>
  )
}

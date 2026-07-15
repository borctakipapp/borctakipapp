import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sonrakiTarihHesapla, gunKaldiHesapla, ikiBasamak } from '@/lib/finans-motoru'
import VergiHarcEkleModal from '@/components/VergiHarcEkleModal'
import VergiHarcDetayModal, { type VergiHarc } from '@/components/VergiHarcDetayModal'
import Monogram from '@/components/Monogram'

const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default async function VergiHarcPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('recurring_items')
    .select('id, saglayici_adi, category, amount, day_of_month, fatura_dongusu, fatura_ay, active')
    .eq('user_id', user.id)
    .eq('vergi_harc_mi', true)
    .order('active', { ascending: false })
    .order('day_of_month', { ascending: true })

  const kayitlar: VergiHarc[] = (data || []).map((k) => ({ ...k, amount: Number(k.amount) }))
  const aktifToplam = kayitlar.filter((k) => k.active).reduce((s, k) => s + k.amount, 0)

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <p className="text-sm text-muted mb-1">Vergi/Harç Hatırlatıcıları</p>
      <p className="font-mono text-4xl font-medium text-navy tracking-tight mb-2">
        {aktifToplam.toLocaleString('tr-TR')} ₺
      </p>
      <p className="text-sm text-muted mb-8">
        {kayitlar.filter((k) => k.active).length === 0 ? 'Henüz aktif bir hatırlatıcı eklemedin' : 'Aktif hatırlatıcıların toplam tutarı'}
      </p>

      <div className="mb-8">
        <VergiHarcEkleModal />
      </div>

      {kayitlar.length === 0 ? (
        <p className="text-muted text-sm bg-white border border-border rounded-lg p-4">
          Henüz bir hatırlatıcı eklemedin — MTV, emlak vergisi gibi periyodik ödemeleri buraya ekleyip Bildirim Zili&apos;nden hatırlatma alabilirsin.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kayitlar.map((k) => {
            const isim = k.saglayici_adi || k.category
            const tarih = sonrakiTarihHesapla(k.day_of_month, bugun, k.fatura_dongusu, k.fatura_ay)
            const tarihStr = `${tarih.getFullYear()}-${ikiBasamak(tarih.getMonth() + 1)}-${ikiBasamak(tarih.getDate())}`
            const gunKaldi = gunKaldiHesapla(tarihStr, bugun)
            const tetikleyici = (
              <div className={`bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center gap-3 cursor-pointer ${!k.active ? 'opacity-50' : ''}`}>
                <Monogram isim={isim} boyut={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm truncate" title={isim}>{isim}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {k.fatura_dongusu === 'yillik' ? `Yıllık · ${AY_ISIMLERI[(k.fatura_ay || 1) - 1]}` : 'Aylık'}
                    {k.active && gunKaldi >= 0 && gunKaldi <= 5 && (
                      <span className="text-amber"> · {gunKaldi === 0 ? 'bugün' : `${gunKaldi} gün kaldı`}</span>
                    )}
                    {k.active && gunKaldi < 0 && <span className="text-brick"> · gecikti</span>}
                  </p>
                </div>
                <p className="font-mono text-sm text-navy shrink-0">{k.amount.toLocaleString('tr-TR')} ₺</p>
              </div>
            )
            return <VergiHarcDetayModal key={k.id} kayit={k} tetikleyici={tetikleyici} />
          })}
        </div>
      )}
    </main>
  )
}

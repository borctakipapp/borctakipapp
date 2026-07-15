import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Monogram from '@/components/Monogram'
import BorcEkleModal from '@/components/BorcEkleModal'
import BorcDetayModal from '@/components/BorcDetayModal'
import PastaGrafik from '@/components/PastaGrafik'
import { BORC_KATEGORI_ETIKET as KATEGORI_ETIKET, BORC_KATEGORI_RENK as KATEGORI_RENK } from '@/lib/borc-kategorileri'
import { toplamBorcHesapla, gunKaldiHesapla } from '@/lib/finans-motoru'

const KATEGORI_IKON: Record<string, string> = {
  kredi_karti: '💳',
  kmh: '🏦',
  ihtiyac_kredisi: '💰',
  konut_kredisi: '🏠',
  tasit_kredisi: '🚗',
  fatura: '⚡',
  kira: '🏠',
  kisisel: '👥',
  taksitli_alisveris: '🛒',
  diger: '📄',
}

// FİNANS MOTORU: gün farkı artık gunKaldiHesapla üzerinden — önceki hâli `Date.now()` (saat
// bileşenli) ile UTC yarı gece tarihini kıyaslıyordu, bu da saat dilimi kaymasına açıktı.
function durumBilgisi(dueDate: string | null, bugun: Date) {
  if (!dueDate) return { renk: 'border-border', etiket: null }
  const gunFarki = gunKaldiHesapla(dueDate, bugun)
  if (gunFarki <= 0) return { renk: 'border-brick', etiket: 'Bugün son gün', renkYazi: 'text-brick' }
  if (gunFarki <= 5) return { renk: 'border-amber', etiket: `${gunFarki} gün kaldı`, renkYazi: 'text-amber' }
  return { renk: 'border-sage', etiket: `${gunFarki} gün kaldı`, renkYazi: 'text-sage' }
}

export default async function BorclarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('status', 'active')
    .order('due_date', { ascending: true })

  // FİNANS MOTORU: toplam borç
  const toplamBorc = toplamBorcHesapla(debts || [])
  const bugunTarih = new Date()

  const kategoriDagilimi = Object.entries(
    (debts || []).reduce((acc: Record<string, number>, d) => {
      acc[d.category] = (acc[d.category] || 0) + Number(d.remaining_amount)
      return acc
    }, {})
  )
    .map(([kategori, tutar]) => ({ ad: KATEGORI_ETIKET[kategori] || kategori, tutar, renk: KATEGORI_RENK[kategori] || '#6b6f7a' }))
    .sort((a, b) => b.tutar - a.tutar)

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-sm text-muted mb-1">Toplam Borcun</p>
        <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
          {toplamBorc.toLocaleString('tr-TR')} ₺
        </p>
        <p className="text-sm text-muted mb-6">
          {debts && debts.length > 0 ? `Toplam ${debts.length} aktif borcun var.` : 'Henüz aktif borcun yok.'}
        </p>

        <div className="mb-8">
          <BorcEkleModal />
        </div>

        {kategoriDagilimi.length > 1 && (
          <>
            <h2 className="text-sm font-medium text-muted mb-3">Kategoriye Göre Dağılım</h2>
            <div className="bg-white rounded-lg border border-border p-5 mb-8">
              <PastaGrafik dilimler={kategoriDagilimi} />
            </div>
          </>
        )}

        <h2 className="text-sm font-medium text-muted mb-3">Borçlarınız</h2>

        {(!debts || debts.length === 0) && (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz borç eklemedin. Harika bir başlangıç, hiç eklemene gerek kalmasa daha da iyi olurdu! 🙂
          </p>
        )}

        <div className="flex flex-col gap-2">
          {debts?.map((debt) => {
            const durum = durumBilgisi(debt.due_date, bugunTarih)
            return (
              <BorcDetayModal
                key={debt.id}
                debtId={debt.id}
                tetikleyici={
                  <div className={`bg-white rounded-lg pl-4 pr-4 py-3 flex items-center gap-3 border-l-4 ${durum.renk} hover:shadow-sm transition-shadow cursor-pointer`}>
                    <Monogram isim={debt.institution_name} boyut={38} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy text-sm flex items-center gap-1 min-w-0" title={debt.institution_name}>
                        <span className="shrink-0">{KATEGORI_IKON[debt.category] || '📄'}</span>
                        <span className="truncate min-w-0">{debt.institution_name}</span>
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {KATEGORI_ETIKET[debt.category] || debt.category}
                        {durum.etiket && (
                          <span className={`ml-2 ${durum.renkYazi}`}>· {durum.etiket}</span>
                        )}
                      </p>
                    </div>
                    <span className="font-mono text-navy text-sm shrink-0">
                      {Number(debt.remaining_amount).toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                }
              />
            )
          })}
        </div>
      </main>
    
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppHeader from '@/components/AppHeader'
import AltNavigasyon from '@/components/AltNavigasyon'
import Monogram from '@/components/Monogram'

const KATEGORI_ETIKET: Record<string, string> = {
  kredi_karti: 'Kredi Kartı',
  ihtiyac_kredisi: 'İhtiyaç Kredisi',
  konut_kredisi: 'Konut Kredisi',
  tasit_kredisi: 'Taşıt Kredisi',
  fatura: 'Fatura',
  kira: 'Kira',
  kisisel: 'Kişisel Borç',
  taksitli_alisveris: 'Taksitli Alışveriş',
  diger: 'Diğer',
}

const KATEGORI_IKON: Record<string, string> = {
  kredi_karti: '💳',
  ihtiyac_kredisi: '💰',
  konut_kredisi: '🏠',
  tasit_kredisi: '🚗',
  fatura: '⚡',
  kira: '🏠',
  kisisel: '👥',
  taksitli_alisveris: '🛒',
  diger: '📄',
}

function durumBilgisi(dueDate: string | null) {
  if (!dueDate) return { renk: 'border-border', etiket: null }
  const gunFarki = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
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

  const toplamBorc = (debts || []).reduce((sum, d) => sum + Number(d.remaining_amount), 0)

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader aktif="borclar" />
<main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-sm text-muted mb-1">Toplam Borcun</p>
        <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
          {toplamBorc.toLocaleString('tr-TR')} ₺
        </p>
        <p className="text-sm text-muted mb-6">
          {debts && debts.length > 0 ? `Toplam ${debts.length} aktif borcun var.` : 'Henüz aktif borcun yok.'}
        </p>

        <Link
          href="/dashboard/borc/ekle"
          className="inline-block mb-8 bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Yeni Borç Ekle
        </Link>

        <h2 className="text-sm font-medium text-muted mb-3">Borçlarınız</h2>

        {(!debts || debts.length === 0) && (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz borç eklemedin. Harika bir başlangıç, hiç eklemene gerek kalmasa daha da iyi olurdu! 🙂
          </p>
        )}

        <div className="flex flex-col gap-2">
          {debts?.map((debt) => {
            const durum = durumBilgisi(debt.due_date)
            return (
              <Link
                key={debt.id}
                href={`/dashboard/borc/${debt.id}`}
                className={`bg-white rounded-lg pl-4 pr-4 py-3 flex items-center gap-3 border-l-4 ${durum.renk} hover:shadow-sm transition-shadow`}
              >
                <Monogram isim={debt.institution_name} boyut={38} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm truncate">
                    <span className="mr-1">{KATEGORI_IKON[debt.category] || '📄'}</span>
                    {debt.institution_name}
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
              </Link>
            )
          })}
        </div>
      </main>

      <AltNavigasyon aktif="borclar" />
    </div>
  )
}
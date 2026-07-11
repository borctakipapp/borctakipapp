import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BildirimZili from '@/components/BildirimZili'

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
        <span className="text-paper text-sm font-medium border-b-2 border-paper pb-1">Borçlar</span>
        <Link href="/dashboard/gelir-gider" className="text-paper/60 hover:text-paper text-sm pb-1">Gelir-Gider</Link>
        <Link href="/dashboard/birikim" className="text-paper/60 hover:text-paper text-sm pb-1">Birikim</Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-sm text-muted mb-1">{user.email}</p>
        <p className="text-sm text-muted mb-1">Toplam borcunuz</p>
        <p className="font-mono text-4xl font-medium text-navy tracking-tight mb-6">
          {toplamBorc.toLocaleString('tr-TR')} ₺
        </p>

        <Link
          href="/dashboard/borc-ekle"
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
                className={`bg-white rounded-lg pl-4 pr-4 py-3 flex items-center justify-between border-l-4 ${durum.renk} hover:shadow-sm transition-shadow`}
              >
                <div>
                  <p className="font-medium text-navy text-sm">{debt.institution_name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {KATEGORI_ETIKET[debt.category] || debt.category}
                    {durum.etiket && (
                      <span className={`ml-2 ${durum.renkYazi}`}>· {durum.etiket}</span>
                    )}
                  </p>
                </div>
                <span className="font-mono text-navy text-sm">
                  {Number(debt.remaining_amount).toLocaleString('tr-TR')} ₺
                </span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toplamBekleyenAlacakHesapla } from '@/lib/finans-motoru'
import ReceivableEkleModal from '@/components/ReceivableEkleModal'
import AlacaklarListesi from '@/components/AlacaklarListesi'

export default async function AlacaklarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: receivables } = await supabase
    .from('receivables')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const toplamBekleyen = toplamBekleyenAlacakHesapla(receivables || [])

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <p className="text-sm text-muted mb-1">Bekleyen Alacaklar</p>
      <p className="font-mono text-5xl font-medium text-navy tracking-tight mb-2">
        {toplamBekleyen.toLocaleString('tr-TR')} ₺
      </p>
      <p className="text-sm text-muted mb-8">
        {toplamBekleyen === 0 ? 'Şu an bekleyen bir alacağın yok' : 'Sana borçlu olanların toplamı'}
      </p>

      <div className="mb-8">
        <ReceivableEkleModal />
      </div>

      <AlacaklarListesi receivables={receivables || []} />
    </main>
  )
}
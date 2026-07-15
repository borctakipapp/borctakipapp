import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VeriSifirlamaKart from '@/components/VeriSifirlamaKart'

export default async function AyarlarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="max-w-lg mx-auto px-6 py-10 pb-24 md:pb-10">
      <p className="text-sm text-muted mb-1">Hesap</p>
      <p className="text-2xl font-medium text-navy mb-8">Ayarlar</p>

      <VeriSifirlamaKart />
    </main>
  )
}

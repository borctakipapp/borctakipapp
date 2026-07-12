import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Monogram from '@/components/Monogram'

export default async function DavetPage({
  params,
}: {
  params: Promise<{ kod: string }>
}) {
  const { kod } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?sonra=/davet/${kod}`)
  }

  const admin = createAdminClient()
  const { data: grup } = await admin.from('gruplar').select('id, ad').eq('davet_kodu', kod).single()

  if (!grup) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6">
        <div className="bg-paper rounded-xl p-6 max-w-sm w-full text-center">
          <p className="text-navy text-sm">Bu davet linki geçersiz veya süresi dolmuş.</p>
          <Link href="/dashboard" className="text-xs text-muted underline mt-3 inline-block">Panele dön</Link>
        </div>
      </div>
    )
  }

  const { data: mevcutUyelik } = await supabase
    .from('grup_uyeler')
    .select('id')
    .eq('grup_id', grup.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (mevcutUyelik) {
    redirect(`/dashboard/gruplar/${grup.id}`)
  }

  async function katil() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const gorunenAd = profil?.full_name?.trim() || user.email

    await supabase.from('grup_uyeler').insert({
      grup_id: grup!.id,
      user_id: user.id,
      ad_soyad: gorunenAd,
    })

    redirect(`/dashboard/gruplar/${grup!.id}`)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="bg-paper rounded-xl p-6 max-w-sm w-full text-center">
        <div className="flex justify-center mb-4">
          <Monogram isim={grup.ad} boyut={56} />
        </div>
        <p className="text-xs text-muted mb-1">Bir gruba davet edildin</p>
        <h1 className="text-xl font-medium text-navy mb-6">{grup.ad}</h1>

        <form action={katil}>
          <button
            type="submit"
            className="w-full bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors"
          >
            Gruba Katıl
          </button>
        </form>

        <Link href="/dashboard" className="text-xs text-muted underline mt-4 inline-block">Vazgeç</Link>
      </div>
    </div>
  )
}

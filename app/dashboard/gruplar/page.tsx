import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppHeader from '@/components/AppHeader'
import Monogram from '@/components/Monogram'

export default async function GruplarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: uyelikler } = await supabase
    .from('grup_uyeler')
    .select('grup_id, gruplar(id, ad, davet_kodu, created_at)')
    .eq('user_id', user.id)

  const gruplar = (uyelikler || []).map((u: any) => u.gruplar).filter(Boolean)

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader aktif="gruplar" />
      <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-sm text-muted mb-1">Ortak Hesap</p>
        <p className="text-2xl font-medium text-navy mb-6">Gruplarım</p>

        <Link
          href="/dashboard/gruplar/olustur"
          className="inline-block mb-8 bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Yeni Grup Oluştur
        </Link>

        {gruplar.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz bir grubun yok. Tatil, ev arkadaşlığı gibi ortak harcamaları paylaştığın bir grup oluşturup arkadaşlarını davet edebilirsin.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {gruplar.map((g: any) => (
              <Link
                key={g.id}
                href={`/dashboard/gruplar/${g.id}`}
                className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center gap-3"
              >
                <Monogram isim={g.ad} boyut={38} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm truncate">{g.ad}</p>
                  <p className="text-xs text-muted mt-0.5">{new Date(g.created_at).toLocaleDateString('tr-TR')} tarihinde oluşturuldu</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
import Link from 'next/link'
import { adminGirisKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminGruplarPage() {
  await adminGirisKontrol()
  const admin = createAdminClient()

  const { data: gruplar } = await admin.from('gruplar').select('id, ad, created_at').order('created_at', { ascending: false })
  const { data: tumUyelikler } = await admin.from('grup_uyeler').select('grup_id, aktif')

  const uyeSayilari: Record<string, number> = {}
  ;(tumUyelikler || []).forEach((u) => {
    if (u.aktif) uyeSayilari[u.grup_id] = (uyeSayilari[u.grup_id] || 0) + 1
  })

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp · admin</span>
        <Link href="/admin" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
          ← Admin Paneline Dön
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">Ortak Hesap Grupları</h1>
        <p className="text-sm text-muted mb-6">Toplam {gruplar?.length || 0} grup</p>

        <div className="flex flex-col gap-2">
          {(!gruplar || gruplar.length === 0) && (
            <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç grup yok.</p>
          )}
          {gruplar?.map((g) => (
            <Link
              key={g.id}
              href={`/admin/gruplar/${g.id}`}
              className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-navy text-sm">{g.ad}</p>
                <p className="text-xs text-muted mt-0.5">{new Date(g.created_at).toLocaleDateString('tr-TR')} · {uyeSayilari[g.id] || 0} aktif üye</p>
              </div>
              <span className="text-muted text-xs">→</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

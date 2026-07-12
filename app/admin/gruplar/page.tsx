import Link from 'next/link'
import { adminGirisKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminGrupKullaniciArama from '@/components/AdminGrupKullaniciArama'

export default async function AdminGruplarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await adminGirisKontrol()
  const { q } = await searchParams
  const admin = createAdminClient()

  let sonuclar: { id: string; ad: string; created_at: string; uyeSayisi: number }[] = []
  let aramaYapildi = false
  let aranankulanici: { email: string } | null = null

  if (q && q.trim()) {
    aramaYapildi = true
    const { data: kullanicilar } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const hedef = kullanicilar?.users.find((u) => u.email?.toLowerCase().includes(q.toLowerCase().trim()))

    if (hedef) {
      aranankulanici = { email: hedef.email || '' }
      const { data: uyelikler } = await admin
        .from('grup_uyeler')
        .select('grup_id, gruplar(id, ad, created_at)')
        .eq('user_id', hedef.id)

      const grupIdler = (uyelikler || []).map((u: any) => u.gruplar?.id).filter(Boolean)
      const { data: tumUyelikSayilari } = await admin.from('grup_uyeler').select('grup_id, aktif').in('grup_id', grupIdler)
      const uyeSayilari: Record<string, number> = {}
      ;(tumUyelikSayilari || []).forEach((u) => { if (u.aktif) uyeSayilari[u.grup_id] = (uyeSayilari[u.grup_id] || 0) + 1 })

      sonuclar = (uyelikler || [])
        .map((u: any) => u.gruplar)
        .filter(Boolean)
        .map((g: any) => ({ ...g, uyeSayisi: uyeSayilari[g.id] || 0 }))
    }
  }

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
        <p className="text-sm text-muted mb-6">Bir kullanıcının e-postasını ara, o kullanıcının üye olduğu gruplar listelensin.</p>

        <AdminGrupKullaniciArama baslangicDegeri={q || ''} />

        {aramaYapildi && !aranankulanici && (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border mt-6">Bu e-posta ile kayıtlı bir kullanıcı bulunamadı.</p>
        )}

        {aranankulanici && (
          <div className="mt-6">
            <p className="text-xs text-muted mb-3">{aranankulanici.email} · {sonuclar.length} grup üyeliği</p>
            <div className="flex flex-col gap-2">
              {sonuclar.length === 0 && (
                <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Bu kullanıcı hiçbir gruba üye değil.</p>
              )}
              {sonuclar.map((g) => (
                <Link
                  key={g.id}
                  href={`/admin/gruplar/${g.id}`}
                  className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-navy text-sm">{g.ad}</p>
                    <p className="text-xs text-muted mt-0.5">{new Date(g.created_at).toLocaleDateString('tr-TR')} · {g.uyeSayisi} aktif üye</p>
                  </div>
                  <span className="text-muted text-xs">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
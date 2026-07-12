import Link from 'next/link'
import { adminGirisKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminKullanicilarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await adminGirisKontrol()
  const admin = createAdminClient()
  const { q } = await searchParams
  const arama = (q || '').trim()

  // auth.users listesini admin API ile çekiyoruz (email burada duruyor, profiles'ta değil)
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  let kullanicilar = authData?.users || []

  if (arama) {
    kullanicilar = kullanicilar.filter(
      (u) => u.email?.toLowerCase().includes(arama.toLowerCase()) || u.id.includes(arama)
    )
  }

  kullanicilar.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const gosterilecekler = kullanicilar.slice(0, 100)

  // Her kullanıcının toplam borcunu hesapla
  const userIds = gosterilecekler.map((u) => u.id)
  const { data: borclar } = await admin.from('debts').select('user_id, remaining_amount').eq('status', 'active').in('user_id', userIds)
  const borcMap: Record<string, number> = {}
  for (const b of borclar || []) {
    borcMap[b.user_id] = (borcMap[b.user_id] || 0) + Number(b.remaining_amount)
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp · admin</span>
        <Link href="/dashboard" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
          Uygulamaya dön
        </Link>
      </header>

      <nav className="bg-navy-light px-6 py-2 flex gap-4">
        <Link href="/admin" className="text-paper/60 hover:text-paper text-sm pb-1">Genel Bakış</Link>
        <span className="text-paper text-sm font-medium border-b-2 border-paper pb-1">Kullanıcılar</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">Kullanıcılar</h1>
        <p className="text-xs text-muted mb-6">Toplam {kullanicilar.length} kullanıcı {arama && `· "${arama}" için filtrelendi`}</p>

        <form method="GET" className="mb-6">
          <input
            type="text" name="q" defaultValue={arama}
            placeholder="ID veya e-posta ile ara..."
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
          />
        </form>

        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-4 py-2.5 font-medium text-xs">E-posta</th>
                <th className="px-4 py-2.5 font-medium text-xs">Kayıt Tarihi</th>
                <th className="px-4 py-2.5 font-medium text-xs text-right">Toplam Borç</th>
              </tr>
            </thead>
            <tbody>
              {gosterilecekler.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-paper transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/kullanicilar/${u.id}`} className="text-navy font-medium hover:underline">
                      {u.email}
                    </Link>
                    <p className="text-[11px] text-muted font-mono">{u.id.slice(0, 8)}...</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-navy">
                    {(borcMap[u.id] || 0).toLocaleString('tr-TR')} ₺
                  </td>
                </tr>
              ))}
              {gosterilecekler.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted text-sm">Sonuç bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

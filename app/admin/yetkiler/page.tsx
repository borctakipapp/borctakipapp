import { redirect } from 'next/navigation'
import Link from 'next/link'
import { adminGirisKontrol, adminYetkiKontrol, adminTumYetkileriGetir, TUM_YETKILER } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import YetkiDuzenleModal from '@/components/YetkiDuzenleModal'

export default async function YetkiYonetimiPage() {
  await adminGirisKontrol()
  const yetkim = await adminYetkiKontrol('yetki_yonetimi')
  if (!yetkim) redirect('/admin')

  const admin = createAdminClient()
  const { data: kullanicilar } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const adminler = (kullanicilar?.users || []).filter((u) => (u.user_metadata as any)?.is_admin || u.email === 'borctakipapp@gmail.com')

  // profiles tablosundan is_admin=true olanları çekmek daha güvenilir — auth metadata'ya güvenmeyelim
  const { data: adminProfilleri } = await admin.from('profiles').select('id, full_name').eq('is_admin', true)
  const adminIdleri = new Set((adminProfilleri || []).map((p) => p.id))
  const gercekAdminler = (kullanicilar?.users || []).filter((u) => adminIdleri.has(u.id) || u.email === 'borctakipapp@gmail.com')

  const kurucuEmail = 'borctakipapp@gmail.com'

  const satirlar = await Promise.all(
    gercekAdminler.map(async (u) => {
      const kurucuMu = u.email === kurucuEmail
      const yetkiler = await adminTumYetkileriGetir(u.id, kurucuMu)
      const profil = (adminProfilleri || []).find((p) => p.id === u.id)
      return { id: u.id, email: u.email || '', adSoyad: profil?.full_name || '', kurucuMu, yetkiler: Array.from(yetkiler) }
    })
  )

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <Link href="/admin" className="text-paper/70 hover:text-paper text-sm">← Admin Paneline Dön</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">Yetki Yönetimi</h1>
        <p className="text-sm text-muted mb-6">Adminlere hangi işlemleri yapabileceklerini tek tek belirle.</p>

        <div className="flex flex-col gap-3">
          {satirlar.map((s) => (
            <div key={s.id} className="bg-white rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-navy">{s.adSoyad || s.email}</p>
                  <p className="text-xs text-muted">{s.email}{s.kurucuMu && ' · Kurucu hesap'}</p>
                </div>
                {!s.kurucuMu && <YetkiDuzenleModal userId={s.id} mevcutYetkiler={s.yetkiler} />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TUM_YETKILER.map((y) => (
                  <span
                    key={y.anahtar}
                    className={`text-[10px] px-2 py-1 rounded-full ${
                      s.yetkiler.includes(y.anahtar) ? 'bg-sage-soft text-sage' : 'bg-paper text-muted'
                    }`}
                  >
                    {y.etiket}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

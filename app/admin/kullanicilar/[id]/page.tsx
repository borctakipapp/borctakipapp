import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminGirisKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

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

export default async function AdminKullaniciDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await adminGirisKontrol()
  const admin = createAdminClient()
  const { id } = await params

  const { data: authUser } = await admin.auth.admin.getUserById(id)
  if (!authUser?.user) notFound()

  const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single()
  const { data: borclar } = await admin.from('debts').select('*').eq('user_id', id).order('created_at', { ascending: false })
  const { data: hedefler } = await admin.from('savings_goals').select('*').eq('user_id', id)

  const aktifBorclar = (borclar || []).filter((b) => b.status === 'active')
  const toplamBorc = aktifBorclar.reduce((s, b) => s + Number(b.remaining_amount), 0)
  const toplamBirikim = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp · admin</span>
        <Link href="/admin/kullanicilar" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
          ← Kullanıcılara dön
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">{authUser.user.email}</h1>
        <p className="text-xs text-muted font-mono mb-6">{id}</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Borç</p>
            <p className="font-mono text-xl text-navy font-medium">{toplamBorc.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Birikim</p>
            <p className="font-mono text-xl text-sage font-medium">{toplamBirikim.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Profil Bilgileri</h2>
        <div className="bg-white rounded-lg p-4 border border-border mb-8 text-sm">
          {profile ? (
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div><span className="text-muted">Ad Soyad: </span><span className="text-navy">{profile.full_name || '—'}</span></div>
              <div><span className="text-muted">Telefon: </span><span className="text-navy">{profile.phone || '—'}</span></div>
              <div><span className="text-muted">Şehir: </span><span className="text-navy">{profile.city || '—'}</span></div>
              <div><span className="text-muted">Cinsiyet: </span><span className="text-navy">{profile.gender || '—'}</span></div>
              <div><span className="text-muted">Gelir Aralığı: </span><span className="text-navy">{profile.income_range || '—'}</span></div>
              <div><span className="text-muted">Hane: </span><span className="text-navy">{profile.household_size || '—'}</span></div>
            </div>
          ) : (
            <p className="text-muted">Profil bilgisi girilmemiş.</p>
          )}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Borçları ({borclar?.length || 0})</h2>
        <div className="flex flex-col gap-2 mb-8">
          {(!borclar || borclar.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç borç kaydı yok.</p>}
          {borclar?.map((b) => (
            <div key={b.id} className={`bg-white rounded-lg px-4 py-3 flex items-center justify-between border-l-4 ${b.status === 'active' ? 'border-brick' : 'border-sage'}`}>
              <div>
                <p className="font-medium text-navy text-sm">{b.institution_name}</p>
                <p className="text-xs text-muted">{KATEGORI_ETIKET[b.category] || b.category} · {b.status === 'active' ? 'Aktif' : 'Kapandı'}</p>
              </div>
              <span className="font-mono text-navy text-sm">{Number(b.remaining_amount).toLocaleString('tr-TR')} ₺</span>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Birikim Hedefleri ({hedefler?.length || 0})</h2>
        <div className="flex flex-col gap-2">
          {(!hedefler || hedefler.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç hedef yok.</p>}
          {hedefler?.map((h) => (
            <div key={h.id} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-border">
              <p className="font-medium text-navy text-sm">{h.goal_name}</p>
              <span className="font-mono text-navy text-sm">
                {Number(h.current_amount).toLocaleString('tr-TR')} / {Number(h.target_amount).toLocaleString('tr-TR')} ₺
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
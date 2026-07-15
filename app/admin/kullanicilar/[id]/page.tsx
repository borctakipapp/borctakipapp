import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminGirisKontrol, adminYetkiKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminKullaniciDuzenleModal from '@/components/AdminKullaniciDuzenleModal'
import AdminKullaniciSilPasifModal from '@/components/AdminKullaniciSilPasifModal'
import AdminBorcDuzenleModal from '@/components/AdminBorcDuzenleModal'
import AdminHedefDuzenleModal from '@/components/AdminHedefDuzenleModal'
import AdminAlacakDuzenleModal from '@/components/AdminAlacakDuzenleModal'
import { BORC_KATEGORI_ETIKET as KATEGORI_ETIKET } from '@/lib/borc-kategorileri'
import { toplamBorcHesapla, toplamBirikimHesapla, toplamBekleyenAlacakHesapla } from '@/lib/finans-motoru'

export default async function AdminKullaniciDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await adminGirisKontrol()
  const [duzenleYetkisi, silYetkisi, veriYetkisi] = await Promise.all([
    adminYetkiKontrol('kullanici_duzenle'),
    adminYetkiKontrol('kullanici_sil'),
    adminYetkiKontrol('veri_mudahale'),
  ])

  const admin = createAdminClient()
  const { id } = await params

  const { data: authUser } = await admin.auth.admin.getUserById(id)
  if (!authUser?.user) notFound()

  const pasifMi = !!authUser.user.banned_until && new Date(authUser.user.banned_until) > new Date()

  const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single()
  const { data: borclar } = await admin.from('debts').select('*').eq('user_id', id).order('created_at', { ascending: false })
  const { data: hedefler } = await admin.from('savings_goals').select('*').eq('user_id', id)
  const { data: alacaklar } = await admin.from('receivables').select('*').eq('user_id', id).order('created_at', { ascending: false })

  // --- FİNANS MOTORU: admin paneli artık kendi hesabını yapmıyor, kullanıcı tarafındaki
  // AYNI fonksiyonları çağırıyor (toplamBorcHesapla, toplamBirikimHesapla,
  // toplamBekleyenAlacakHesapla) — TECHNICAL_DEBT.md madde 2 kapandı. ---
  const toplamBorc = toplamBorcHesapla(borclar || [])
  const toplamBirikim = toplamBirikimHesapla(hedefler || [])
  const toplamBekleyenAlacak = toplamBekleyenAlacakHesapla(alacaklar || [])

  return (
    <>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/admin/kullanicilar" className="text-xs text-muted hover:text-navy transition-colors mb-3 inline-block">
          ← Kullanıcılara dön
        </Link>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-medium text-navy">{authUser.user.email}</h1>
          {pasifMi && <span className="text-[11px] bg-brick-soft text-brick px-2 py-0.5 rounded-full">Pasif</span>}
        </div>
        <p className="text-xs text-muted font-mono mb-4">{id}</p>

        {(duzenleYetkisi || silYetkisi) && (
          <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-lg p-3 border border-border">
            {duzenleYetkisi && <AdminKullaniciDuzenleModal userId={id} profil={profile} />}
            {silYetkisi && <AdminKullaniciSilPasifModal userId={id} pasifMi={pasifMi} email={authUser.user.email || ''} />}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Borç</p>
            <p className="font-mono text-xl text-navy font-medium">{toplamBorc.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Birikim</p>
            <p className="font-mono text-xl text-sage font-medium">{toplamBirikim.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Bekleyen Alacak</p>
            <p className="font-mono text-xl text-amber font-medium">{toplamBekleyenAlacak.toLocaleString('tr-TR')} ₺</p>
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
          {borclar?.map((b) => {
            const satir = (
              <div className={`bg-white rounded-lg px-4 py-3 flex items-center justify-between border-l-4 ${b.status === 'active' ? 'border-brick' : 'border-sage'} ${veriYetkisi ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
                <div>
                  <p className="font-medium text-navy text-sm">{b.institution_name}</p>
                  <p className="text-xs text-muted">{KATEGORI_ETIKET[b.category] || b.category} · {b.status === 'active' ? 'Aktif' : 'Kapandı'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-navy text-sm">{Number(b.remaining_amount).toLocaleString('tr-TR')} ₺</span>
                  {veriYetkisi && <span className="text-muted text-xs">✎</span>}
                </div>
              </div>
            )
            return veriYetkisi ? (
              <AdminBorcDuzenleModal key={b.id} borc={b} userId={id} tetikleyici={satir} />
            ) : (
              <div key={b.id}>{satir}</div>
            )
          })}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Birikim Hedefleri ({hedefler?.length || 0})</h2>
        <div className="flex flex-col gap-2">
          {(!hedefler || hedefler.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç hedef yok.</p>}
          {hedefler?.map((h) => {
            const satir = (
              <div className={`bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-border ${veriYetkisi ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
                <p className="font-medium text-navy text-sm">{h.goal_name}</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-navy text-sm">
                    {Number(h.current_amount).toLocaleString('tr-TR')} / {Number(h.target_amount).toLocaleString('tr-TR')} ₺
                  </span>
                  {veriYetkisi && <span className="text-muted text-xs">✎</span>}
                </div>
              </div>
            )
            return veriYetkisi ? (
              <AdminHedefDuzenleModal key={h.id} hedef={h} userId={id} tetikleyici={satir} />
            ) : (
              <div key={h.id}>{satir}</div>
            )
          })}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3 mt-8">Bekleyen Alacaklar ({alacaklar?.length || 0})</h2>
        <div className="flex flex-col gap-2">
          {(!alacaklar || alacaklar.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç alacak kaydı yok.</p>}
          {alacaklar?.map((a) => {
            const durumEtiket = a.status === 'pending' ? 'Bekliyor' : a.status === 'completed' ? 'Tamamlandı' : 'İptal'
            const kenarRengi = a.status === 'pending' ? 'border-amber' : a.status === 'completed' ? 'border-sage' : 'border-muted'
            const satir = (
              <div className={`bg-white rounded-lg px-4 py-3 flex items-center justify-between border-l-4 ${kenarRengi} ${veriYetkisi ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
                <div>
                  <p className="font-medium text-navy text-sm">{a.contact_name}</p>
                  <p className="text-xs text-muted">{durumEtiket}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-navy text-sm">{Number(a.remaining_amount).toLocaleString('tr-TR')} ₺</span>
                  {veriYetkisi && <span className="text-muted text-xs">✎</span>}
                </div>
              </div>
            )
            return veriYetkisi ? (
              <AdminAlacakDuzenleModal key={a.id} alacak={a} userId={id} tetikleyici={satir} />
            ) : (
              <div key={a.id}>{satir}</div>
            )
          })}
        </div>
      </main>
    </>
  )
}

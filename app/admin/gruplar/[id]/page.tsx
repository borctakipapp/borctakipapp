import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminGirisKontrol, adminYetkiKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AdminHarcamaSilButonu, AdminOdemeSilButonu, AdminUyeCikarButonu, AdminUyeEkleModal, AdminGrupSilButonu,
} from '@/components/AdminGrupAksiyonlari'

export default async function AdminGrupDetayPage({ params }: { params: Promise<{ id: string }> }) {
  await adminGirisKontrol()
  const veriYetkisi = await adminYetkiKontrol('veri_mudahale')

  const admin = createAdminClient()
  const { id } = await params

  const { data: grup } = await admin.from('gruplar').select('*').eq('id', id).single()
  if (!grup) notFound()

  const { data: uyeler } = await admin.from('grup_uyeler').select('*').eq('grup_id', id).order('katilma_tarihi', { ascending: true })
  const { data: harcamalar } = await admin.from('grup_harcamalar').select('*').eq('grup_id', id).order('tarih', { ascending: false })
  const { data: odemeler } = await admin.from('grup_odemeler').select('*').eq('grup_id', id).order('created_at', { ascending: false })

  const isimBul = (userId: string) => uyeler?.find((u) => u.user_id === userId)?.ad_soyad || 'Bilinmeyen'

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp · admin</span>
        <Link href="/admin/gruplar" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
          ← Gruplara dön
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-medium text-navy">{grup.ad}</h1>
          {veriYetkisi && <AdminGrupSilButonu grupId={id} ad={grup.ad} />}
        </div>
        <p className="text-xs text-muted mb-8">Oluşturulma: {new Date(grup.created_at).toLocaleDateString('tr-TR')}</p>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">Üyeler ({uyeler?.filter((u) => u.aktif).length || 0} aktif)</h2>
          {veriYetkisi && <AdminUyeEkleModal grupId={id} />}
        </div>
        <div className="flex flex-col gap-2 mb-8">
          {(!uyeler || uyeler.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç üye yok.</p>}
          {uyeler?.map((u) => (
            <div key={u.id} className={`bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-border ${!u.aktif ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-medium text-navy text-sm">{u.ad_soyad}{!u.aktif && <span className="text-muted font-normal text-xs"> · Pasif</span>}</p>
                <p className="text-xs text-muted font-mono">{u.user_id}</p>
              </div>
              {veriYetkisi && u.aktif && <AdminUyeCikarButonu uyelikId={u.id} grupId={id} ad={u.ad_soyad || 'Bu kişi'} />}
            </div>
          ))}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Harcamalar ({harcamalar?.length || 0})</h2>
        <div className="flex flex-col gap-2 mb-8">
          {(!harcamalar || harcamalar.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç harcama yok.</p>}
          {harcamalar?.map((h) => (
            <div key={h.id} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-border">
              <div>
                <p className="font-medium text-navy text-sm">{h.aciklama}</p>
                <p className="text-xs text-muted">{isimBul(h.odeyen_id)} ödedi · {new Date(h.tarih).toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-navy text-sm">{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                {veriYetkisi && <AdminHarcamaSilButonu harcamaId={h.id} grupId={id} aciklama={h.aciklama} />}
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Mutabakat / Ödeme Kayıtları ({odemeler?.length || 0})</h2>
        <div className="flex flex-col gap-2">
          {(!odemeler || odemeler.length === 0) && <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Hiç mutabakat kaydı yok.</p>}
          {odemeler?.map((o) => (
            <div key={o.id} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-border">
              <div>
                <p className="text-sm text-navy">
                  <span className="font-medium">{isimBul(o.odeyen_id)}</span> → <span className="font-medium">{isimBul(o.alan_id)}</span>
                </p>
                <p className="text-xs text-muted">{new Date(o.created_at).toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-navy text-sm">{Number(o.tutar).toLocaleString('tr-TR')} ₺</span>
                {veriYetkisi && <AdminOdemeSilButonu odemeId={o.id} grupId={id} tutar={Number(o.tutar)} />}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

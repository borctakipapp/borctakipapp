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

export default async function AdminPage() {
  await adminGirisKontrol()
  const admin = createAdminClient()

  // Kullanıcı sayıları
  const { count: toplamKullanici } = await admin.from('profiles').select('id', { count: 'exact', head: true })

  const otuzGunOnce = new Date()
  otuzGunOnce.setDate(otuzGunOnce.getDate() - 30)

  // "Aktif" kullanıcı: son 30 günde en az bir borç/işlem/ödeme kaydı oluşturmuş
  const { data: sonBorclar } = await admin.from('debts').select('user_id, created_at').gte('created_at', otuzGunOnce.toISOString())
  const { data: sonIslemler } = await admin.from('transactions').select('user_id, created_at').gte('created_at', otuzGunOnce.toISOString())
  const aktifKullaniciSeti = new Set([
    ...(sonBorclar || []).map((b) => b.user_id),
    ...(sonIslemler || []).map((t) => t.user_id),
  ])

  // Tüm aktif borçlar
  const { data: tumBorclar } = await admin.from('debts').select('category, remaining_amount, user_id').eq('status', 'active')

  const toplamBorcHacmi = (tumBorclar || []).reduce((s, b) => s + Number(b.remaining_amount), 0)
  const benzersizBorcluSayisi = new Set((tumBorclar || []).map((b) => b.user_id)).size
  const kullaniciBasiOrtalama = benzersizBorcluSayisi > 0 ? toplamBorcHacmi / benzersizBorcluSayisi : 0

  // Kategori bazlı ortalama
  const kategoriToplam: Record<string, { toplam: number; adet: number }> = {}
  for (const b of tumBorclar || []) {
    if (!kategoriToplam[b.category]) kategoriToplam[b.category] = { toplam: 0, adet: 0 }
    kategoriToplam[b.category].toplam += Number(b.remaining_amount)
    kategoriToplam[b.category].adet += 1
  }
  const kategoriOrtalamalari = Object.entries(kategoriToplam)
    .map(([kat, v]) => ({ kategori: KATEGORI_ETIKET[kat] || kat, ortalama: v.toplam / v.adet, adet: v.adet }))
    .sort((a, b) => b.ortalama - a.ortalama)

  const enBuyukOrtalama = Math.max(...kategoriOrtalamalari.map((k) => k.ortalama), 1)

  // Kayıt trendi: son 6 ay, ay bazlı yeni kullanıcı sayısı
  const { data: tumProfiller } = await admin.from('profiles').select('created_at')
  const ayBazliKayit: Record<string, number> = {}
  for (const p of tumProfiller || []) {
    const ayAnahtari = String(p.created_at).slice(0, 7)
    ayBazliKayit[ayAnahtari] = (ayBazliKayit[ayAnahtari] || 0) + 1
  }
  const sonAltiAy = Object.entries(ayBazliKayit).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Genel Bakış</h1>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Kullanıcı</p>
            <p className="font-mono text-2xl text-navy font-medium">{toplamKullanici || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Aktif (son 30 gün)</p>
            <p className="font-mono text-2xl text-sage font-medium">{aktifKullaniciSeti.size}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Toplam Borç Hacmi</p>
            <p className="font-mono text-2xl text-navy font-medium">{toplamBorcHacmi.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Kullanıcı Başı Ortalama</p>
            <p className="font-mono text-2xl text-navy font-medium">{kullaniciBasiOrtalama.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</p>
          </div>
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Kategori Bazlı Ortalama Borç</h2>
        <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5 mb-8">
          {kategoriOrtalamalari.length === 0 && <p className="text-sm text-muted">Henüz veri yok.</p>}
          {kategoriOrtalamalari.map((k) => (
            <div key={k.kategori} className="flex items-center gap-3">
              <span className="text-xs text-navy w-32 shrink-0">{k.kategori}</span>
              <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                <div style={{ width: `${(k.ortalama / enBuyukOrtalama) * 100}%` }} className="h-full rounded-full bg-navy" />
              </div>
              <span className="font-mono text-xs text-muted w-24 text-right shrink-0">
                {k.ortalama.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ ({k.adet})
              </span>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Kayıt Trendi (aylık)</h2>
        <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2 mb-8">
          {sonAltiAy.length === 0 && <p className="text-sm text-muted">Henüz veri yok.</p>}
          {sonAltiAy.map(([ay, adet]) => (
            <div key={ay} className="flex items-center justify-between text-sm">
              <span className="text-navy">{ay}</span>
              <span className="font-mono text-navy">{adet} yeni kullanıcı</span>
            </div>
          ))}
        </div>

        <a
          href="/admin/export"
          className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
        >
          ⬇ Kullanıcı Listesini CSV Olarak İndir
        </a>
      </main>
    </>
  )
}

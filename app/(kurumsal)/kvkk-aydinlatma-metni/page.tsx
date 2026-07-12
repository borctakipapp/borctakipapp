import Link from 'next/link'
import Footer from '@/components/Footer'

export default function KVKKPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center">
        <Link href="/" className="text-paper/70 hover:text-paper text-sm">← Ana sayfaya dön</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-medium text-navy mb-2">KVKK Aydınlatma Metni</h1>
        <p className="text-xs text-muted mb-8">Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>

        <div className="bg-amber-soft border border-amber/30 rounded-lg p-4 mb-8 text-xs text-navy">
          <b>Not:</b> Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında genel bir taslak
          olarak hazırlanmıştır. Gerçek kullanıma almadan önce bir hukuk danışmanına onaylatman gerekir. Köşeli
          parantez içindeki alanları ([ ]) kendi bilgilerinle doldur.
        </div>

        <div className="flex flex-col gap-6 text-sm text-navy">
          <section>
            <h2 className="font-medium mb-2">1. Veri Sorumlusu</h2>
            <p className="text-muted">
              6698 sayılı KVKK uyarınca, kişisel verilerin [AD SOYAD / ŞİRKET UNVANI] ("Veri Sorumlusu") tarafından
              aşağıda açıklanan kapsamda işlenebileceğini bildiririz. İletişim: [E-POSTA ADRESİ], [ADRES varsa]
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">2. İşlenen Kişisel Veri Kategorileri</h2>
            <ul className="text-muted list-disc pl-5 flex flex-col gap-1">
              <li><b>Kimlik verisi:</b> ad soyad, doğum tarihi, cinsiyet (opsiyonel)</li>
              <li><b>İletişim verisi:</b> e-posta, telefon, il/ilçe (opsiyonel)</li>
              <li><b>Finansal veri:</b> borç, gelir-gider, birikim kayıtların</li>
              <li><b>İşlem güvenliği verisi:</b> şifre (şifrelenmiş), oturum bilgileri</li>
            </ul>
          </section>

          <section>
            <h2 className="font-medium mb-2">3. İşleme Amaçları</h2>
            <ul className="text-muted list-disc pl-5 flex flex-col gap-1">
              <li>Uygulama hizmetinin sunulması ve hesabının yönetilmesi</li>
              <li>Kişiselleştirilmiş içerik ve hatırlatmalar sunulması</li>
              <li>Kimliksiz (anonim), toplulaştırılmış istatistik üretilmesi</li>
              <li>Hukuki yükümlülüklerin yerine getirilmesi</li>
            </ul>
          </section>

          <section>
            <h2 className="font-medium mb-2">4. Hukuki Sebep</h2>
            <p className="text-muted">
              Kişisel verilerin, KVKK madde 5/2 kapsamında; bir sözleşmenin kurulması/ifası (hizmet sunumu), açık
              rızan (opsiyonel profil bilgileri için) ve meşru menfaat hukuki sebeplerine dayanarak işlenmektedir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">5. Verilerin Aktarımı</h2>
            <p className="text-muted">
              Verilerin, hizmetin teknik altyapısını sağlayan yurt dışı kaynaklı bulut hizmet sağlayıcısı (Supabase)
              ile, yalnızca hizmetin sunulabilmesi amacıyla sınırlı olarak paylaşılmaktadır. Verilerin pazarlama
              amacıyla üçüncü taraflara satılması veya aktarılması söz konusu değildir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">6. Veri Sahibinin Hakları (KVKK md. 11)</h2>
            <p className="text-muted mb-2">Kişisel verisi işlenen herkes, Veri Sorumlusuna başvurarak:</p>
            <ul className="text-muted list-disc pl-5 flex flex-col gap-1">
              <li>Kişisel verisinin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Eksik/yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK'da öngörülen şartlarda silinmesini/yok edilmesini isteme</li>
              <li>İşlemenin münhasıran otomatik sistemlerle yapılması durumunda ortaya çıkabilecek sonuca itiraz etme</li>
              <li>Zarara uğraması hâlinde zararın giderilmesini talep etme</li>
            </ul>
            <p className="text-muted mt-2">haklarına sahiptir. Talepler [E-POSTA ADRESİ] üzerinden iletilebilir.</p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

import Link from 'next/link'
import Footer from '@/components/Footer'

export default function GizlilikPolitikasiPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center">
        <Link href="/" className="text-paper/70 hover:text-paper text-sm">← Ana sayfaya dön</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-medium text-navy mb-2">Gizlilik Politikası</h1>
        <p className="text-xs text-muted mb-8">Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>

        <div className="bg-amber-soft border border-amber/30 rounded-lg p-4 mb-8 text-xs text-navy">
          <b>Not:</b> Bu metin genel bir taslaktır ve gerçek kullanıma almadan önce bir hukuk danışmanı tarafından
          gözden geçirilmelidir. Köşeli parantez içindeki alanları ([ ]) kendi bilgilerinle doldurman gerekir.
        </div>

        <div className="flex flex-col gap-6 text-sm text-navy">
          <section>
            <h2 className="font-medium mb-2">1. Veri Sorumlusu</h2>
            <p className="text-muted">
              borctakipapp ("biz", "uygulama") olarak, [AD SOYAD / ŞİRKET UNVANI] tarafından işletilen bu uygulamayı
              kullanırken paylaştığın kişisel verilerin gizliliğine önem veriyoruz. İletişim: [E-POSTA ADRESİ]
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">2. Topladığımız Bilgiler</h2>
            <ul className="text-muted list-disc pl-5 flex flex-col gap-1">
              <li>Hesap bilgileri: e-posta adresi, şifre (şifrelenmiş olarak saklanır)</li>
              <li>Opsiyonel profil bilgileri: ad soyad, doğum tarihi, telefon, il/ilçe, cinsiyet, gelir aralığı, hane bilgisi</li>
              <li>Finansal veriler: eklediğin borç, gelir-gider, birikim kayıtları</li>
              <li>Kullanım verileri: giriş zamanları, uygulama içi etkileşimler</li>
            </ul>
          </section>

          <section>
            <h2 className="font-medium mb-2">3. Bu Bilgileri Nasıl Kullanıyoruz</h2>
            <ul className="text-muted list-disc pl-5 flex flex-col gap-1">
              <li>Hesabını oluşturmak ve uygulamayı çalıştırmak için</li>
              <li>Sana kişiselleştirilmiş özet ve hatırlatmalar sunmak için</li>
              <li>Kimliksiz (anonim) genel istatistikler üretmek için (örn. "kullanıcıların ortalama borç kategorisi")</li>
              <li>Yasal yükümlülüklerimizi yerine getirmek için</li>
            </ul>
            <p className="text-muted mt-2">Finansal verilerini asla üçüncü taraflara satmıyor veya reklam amacıyla paylaşmıyoruz.</p>
          </section>

          <section>
            <h2 className="font-medium mb-2">4. Verilerin Saklanması</h2>
            <p className="text-muted">
              Verilerin Supabase (AB/ABD merkezli bir bulut veritabanı sağlayıcısı) üzerinde, şifreli bağlantılarla
              saklanır. Hesabını sildiğinde, ilişkili tüm verilerin de kalıcı olarak silinir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">5. Haklarınız</h2>
            <p className="text-muted">
              KVKK ve ilgili mevzuat kapsamında; verilerine erişme, düzeltme, silme, işlenmesine itiraz etme
              haklarına sahipsin. Bu haklarını kullanmak için [E-POSTA ADRESİ] üzerinden bize ulaşabilirsin.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">6. Çerezler</h2>
            <p className="text-muted">
              Uygulama, oturumunu açık tutmak için gerekli teknik çerezler kullanır. Pazarlama/reklam amaçlı üçüncü
              taraf çerezleri kullanılmamaktadır.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">7. Değişiklikler</h2>
            <p className="text-muted">
              Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde seni bilgilendireceğiz.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
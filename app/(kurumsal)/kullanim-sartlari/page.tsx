import Link from 'next/link'
import Footer from '@/components/Footer'

export default function KullanimSartlariPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center">
        <Link href="/" className="text-paper/70 hover:text-paper text-sm">← Ana sayfaya dön</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-medium text-navy mb-2">Kullanım Şartları</h1>
        <p className="text-xs text-muted mb-8">Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>

        <div className="bg-amber-soft border border-amber/30 rounded-lg p-4 mb-8 text-xs text-navy">
          <b>Not:</b> Bu metin genel bir taslaktır, gerçek kullanıma almadan önce bir hukuk danışmanı tarafından
          gözden geçirilmelidir.
        </div>

        <div className="flex flex-col gap-6 text-sm text-navy">
          <section>
            <h2 className="font-medium mb-2">1. Hizmetin Kapsamı</h2>
            <p className="text-muted">
              borctakipapp, kişisel borç, gelir-gider ve birikim takibi yapmanı sağlayan bir kişisel finans yönetim
              aracıdır. Uygulama bir banka, finans kuruluşu veya yatırım danışmanı değildir; sunduğu hesaplamalar
              (örn. erken kapama analizi) bilgilendirme amaçlıdır, kesin finansal tavsiye niteliği taşımaz.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">2. Hesap Sorumluluğun</h2>
            <p className="text-muted">
              Hesabına ait şifreyi güvende tutmak senin sorumluluğundadır. Hesabından gerçekleşen tüm işlemlerden
              sen sorumlusun. Şüpheli bir durum fark edersen şifreni hemen değiştir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">3. Girdiğin Veriler</h2>
            <p className="text-muted">
              Uygulamaya girdiğin borç, gelir-gider ve diğer finansal bilgilerin doğruluğundan sen sorumlusun.
              Uygulama, girdiğin verilere dayanarak hesaplama ve gösterim yapar; yanlış veri girişinden doğacak
              yanlış hesaplamalardan uygulama sorumlu tutulamaz.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">4. Hizmetin Sürekliliği</h2>
            <p className="text-muted">
              Hizmeti kesintisiz sunmaya çalışıyoruz, ancak bakım, teknik arıza veya öngörülemeyen durumlar
              nedeniyle geçici kesintiler yaşanabilir. Uygulama "olduğu gibi" sunulmaktadır, kesintisiz veya
              hatasız çalışacağına dair garanti verilmemektedir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">5. Yasak Kullanımlar</h2>
            <p className="text-muted">Uygulamayı yasa dışı amaçlarla, başkalarının hesaplarına izinsiz erişmek için veya hizmetin normal işleyişini bozacak şekilde kullanamazsın.</p>
          </section>

          <section>
            <h2 className="font-medium mb-2">6. Hesap Silme</h2>
            <p className="text-muted">
              İstediğin zaman hesabını silme talebinde bulunabilirsin; bu durumda tüm verilerin kalıcı olarak
              silinir.
            </p>
          </section>

          <section>
            <h2 className="font-medium mb-2">7. Değişiklikler</h2>
            <p className="text-muted">Bu şartları zaman zaman güncelleyebiliriz, önemli değişikliklerde seni bilgilendireceğiz.</p>
          </section>

          <section>
            <h2 className="font-medium mb-2">8. İletişim</h2>
            <p className="text-muted">Sorularin için <Link href="/iletisim" className="underline text-navy">İletişim</Link> sayfasından bize ulaşabilirsin.</p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
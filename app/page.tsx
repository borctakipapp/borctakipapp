import Link from 'next/link'
import Footer from '@/components/Footer'

export default function AnaSayfa() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp</span>
        <Link
          href="/login"
          className="text-paper/90 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors"
        >
          Giriş Yap
        </Link>
      </header>

      <main className="flex-1">
        <section className="bg-navy px-6 pt-16 pb-20">
          <div className="max-w-lg mx-auto text-center">
            <p className="font-mono text-4xl font-medium text-paper tracking-tight mb-4">
              Borcunu gör.<br />Kontrolü sen al.
            </p>
            <p className="text-paper/70 text-sm mb-8">
              Kredi kartından ihtiyaç kredisine, kişiye borçtan taksitli alışverişe — tüm borçlarını, gelir-giderini ve
              birikim hedeflerini tek yerde, net bir şekilde takip et.
            </p>
            <Link
              href="/login"
              className="inline-block bg-paper text-navy text-sm font-medium rounded-lg px-6 py-3 hover:bg-white transition-colors"
            >
              Ücretsiz Başla
            </Link>
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="bg-white rounded-lg p-5 border border-border">
              <p className="text-2xl mb-2">💳</p>
              <p className="font-medium text-navy text-sm mb-1">Borç Takibi</p>
              <p className="text-xs text-muted">
                Taksit planını gör, ödeme yap, erken kapamanın ne kadar tasarruf sağlayacağını hesapla.
              </p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-border">
              <p className="text-2xl mb-2">📊</p>
              <p className="font-medium text-navy text-sm mb-1">Gelir-Gider</p>
              <p className="text-xs text-muted">
                Aylık gelir ve giderini, maaşını, düzenli faturalarını otomatik takip et.
              </p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-border">
              <p className="text-2xl mb-2">🎯</p>
              <p className="font-medium text-navy text-sm mb-1">Birikim Hedefleri</p>
              <p className="text-xs text-muted">
                Tatil, acil durum fonu gibi hedefler koy, ilerlemeni görsel olarak takip et.
              </p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-border">
              <p className="text-2xl mb-2">🔔</p>
              <p className="font-medium text-navy text-sm mb-1">Yaklaşan Ödemeler</p>
              <p className="text-xs text-muted">
                Hiçbir ödemeyi kaçırma — süresi yaklaşan ve geciken borçları anında gör.
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="max-w-lg mx-auto text-center bg-white rounded-lg p-8 border border-border">
            <p className="font-medium text-navy mb-2">Ücretsiz, kayıt 1 dakika sürer</p>
            <p className="text-xs text-muted mb-5">Kredi kartı bilgisi istemiyoruz, hemen başlayabilirsin.</p>
            <Link
              href="/login"
              className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-6 py-2.5 hover:bg-navy-light transition-colors"
            >
              Hemen Kayıt Ol
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
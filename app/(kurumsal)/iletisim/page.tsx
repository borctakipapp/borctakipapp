import Link from 'next/link'
import Footer from '@/components/Footer'

export default function IletisimPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center">
        <Link href="/" className="text-paper/70 hover:text-paper text-sm">← Ana sayfaya dön</Link>
      </header>

      <main className="flex-1 max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-medium text-navy mb-3">İletişim</h1>
        <p className="text-sm text-muted mb-8">
          Bir sorun mu yaşıyorsun, önerin mi var, ya da sadece merhaba mı demek istiyorsun? Aşağıdaki adresten bize ulaşabilirsin.
        </p>

        <a
          href="mailto:borctakipapp@gmail.com"
          className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-6 py-3 hover:bg-navy-light transition-colors"
        >
          ✉ borctakipapp@gmail.com
        </a>

        <p className="text-xs text-muted mt-8">
          Genellikle 1-2 iş günü içinde dönüş yapıyoruz.
        </p>
      </main>

      <Footer />
    </div>
  )
}

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-navy px-6 py-8 mt-auto">
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-4 text-center">
        <p className="text-paper font-medium text-sm">borctakipapp</p>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-paper/60">
          <Link href="/gizlilik-politikasi" className="hover:text-paper transition-colors">Gizlilik Politikası</Link>
          <Link href="/kvkk-aydinlatma-metni" className="hover:text-paper transition-colors">KVKK Aydınlatma Metni</Link>
          <Link href="/kullanim-sartlari" className="hover:text-paper transition-colors">Kullanım Şartları</Link>
          <Link href="/iletisim" className="hover:text-paper transition-colors">İletişim</Link>
        </nav>
        <p className="text-[11px] text-paper/40">© {new Date().getFullYear()} borctakipapp. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  )
}

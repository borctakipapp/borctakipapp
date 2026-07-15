'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SEKMELER = [
  { href: '/admin', etiket: 'Genel Bakış' },
  { href: '/admin/kullanicilar', etiket: 'Kullanıcılar' },
  { href: '/admin/gruplar', etiket: 'Ortak Hesap Grupları' },
  { href: '/admin/yetkiler', etiket: 'Yetki Yönetimi' },
] as const

function aktifMi(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname.startsWith(href)
}

export default function AdminHeader() {
  const pathname = usePathname()

  return (
    <div className="sticky top-0 z-20">
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp · admin</span>
        <Link href="/dashboard" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
          Uygulamaya dön
        </Link>
      </header>

      <nav className="bg-navy-light px-6 py-2 flex gap-4 overflow-x-auto">
        {SEKMELER.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`text-sm pb-1 whitespace-nowrap transition-colors ${
              aktifMi(pathname, s.href)
                ? 'text-paper font-medium border-b-2 border-paper'
                : 'text-paper/60 hover:text-paper'
            }`}
          >
            {s.etiket}
          </Link>
        ))}
      </nav>
    </div>
  )
}

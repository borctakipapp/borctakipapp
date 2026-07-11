import Link from 'next/link'
import BildirimZili from './BildirimZili'

export const SEKMELER = [
  { key: 'ozet', href: '/dashboard', etiket: 'Özet', ikon: '🏠' },
  { key: 'borclar', href: '/dashboard/borclar', etiket: 'Borçlar', ikon: '💳' },
  { key: 'gelir-gider', href: '/dashboard/gelir-gider', etiket: 'Gelir-Gider', ikon: '📊' },
  { key: 'birikim', href: '/dashboard/birikim', etiket: 'Birikim', ikon: '🎯' },
] as const

export type SekmeKey = typeof SEKMELER[number]['key']

export default function AppHeader({ aktif }: { aktif: SekmeKey }) {
  return (
    <>
      <header className="bg-navy px-6 py-4 flex items-center justify-between">
        <span className="text-paper font-medium text-sm tracking-wide">borctakipapp</span>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profil" className="text-paper/80 hover:text-paper p-1.5" aria-label="Profilim">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <BildirimZili />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-paper/70 hover:text-paper text-xs border border-paper/30 rounded-md px-3 py-1.5 transition-colors">
              Çıkış Yap
            </button>
          </form>
        </div>
      </header>

      {/* Masaüstü: yatay sekme çubuğu. Mobilde gizli, onun yerine alt navigasyon var. */}
      <nav className="hidden md:flex bg-navy-light px-6 py-2 gap-4">
        {SEKMELER.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={
              s.key === aktif
                ? 'text-paper text-sm font-medium border-b-2 border-paper pb-1'
                : 'text-paper/60 hover:text-paper text-sm pb-1'
            }
          >
            {s.etiket}
          </Link>
        ))}
      </nav>
    </>
  )
}
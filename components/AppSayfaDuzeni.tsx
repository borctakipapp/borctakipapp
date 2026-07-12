import Link from 'next/link'
import BildirimZili from './BildirimZili'
import AltNavigasyon from './AltNavigasyon'
import { SEKMELER, type SekmeKey } from './AppHeader'

export default function AppSayfaDuzeni({ aktif, children }: { aktif: SekmeKey; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Masaüstü kenar çubuğu */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-navy min-h-screen sticky top-0 self-start">
        <div className="px-5 py-5">
          <span className="text-paper font-medium text-sm tracking-wide">borctakipapp</span>
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {SEKMELER.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                s.key === aktif ? 'bg-paper/10 text-paper font-medium' : 'text-paper/60 hover:bg-paper/5 hover:text-paper'
              }`}
            >
              <span>{s.ikon}</span>{s.etiket}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4 flex flex-col gap-1 border-t border-paper/10 pt-3">
          <Link href="/dashboard/profil" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-paper/60 hover:bg-paper/5 hover:text-paper transition-colors">
            <span>👤</span>Profil
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-paper/60 hover:bg-paper/5 hover:text-paper transition-colors text-left">
              <span>🚪</span>Çıkış Yap
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 md:min-w-0">
        {/* Mobil üst bar — sadece mobilde görünür, masaüstünde kenar çubuğu bu işi yapıyor */}
        <header className="md:hidden bg-navy px-6 py-4 flex items-center justify-between">
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

        {/* Masaüstü ince üst şerit — sadece bildirim zili */}
        <div className="hidden md:flex justify-end px-8 py-4">
          <BildirimZili />
        </div>

        {children}

        <AltNavigasyon aktif={aktif} />
      </div>
    </div>
  )
}

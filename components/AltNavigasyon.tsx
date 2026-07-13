import Link from 'next/link'
import { SEKMELER, type SekmeKey } from './AppHeader'

export default function AltNavigasyon({ aktif }: { aktif: SekmeKey }) {
  // "masaustuSadece" işaretli sekmeler (örn. Alacaklar) mobil alt navda gösterilmez.
  const mobilSekmeler = SEKMELER.filter((s) => !('masaustuSadece' in s && s.masaustuSadece))
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex items-center justify-around py-1.5 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
    >
      {mobilSekmeler.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] rounded-lg transition-colors ${
            s.key === aktif ? 'text-navy font-medium' : 'text-muted'
          }`}
        >
          <span className="text-lg leading-none">{s.ikon}</span>
          {s.etiket}
        </Link>
      ))}
    </nav>
  )
}
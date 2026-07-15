import Link from 'next/link'
import { SEKMELER, type SekmeKey } from './AppHeader'
import MobilMenu from './MobilMenu'

// Alt navigasyon artık TÜM sekmeleri göstermiyor — 10 sekme oldu, bottom bar'a sığmıyor
// (5+ sekme mobilde parmakla dokunması zor küçük hedeflere dönüşüyor). Sadece en sık
// kullanılan 4 "çekirdek" sekme burada sabit, geri kalanı "Daha Fazla" menüsünde
// (MobilMenu.tsx — soldan açılan panel, masaüstü kenar çubuğuyla aynı listeyi gösterir).
const CORE_SEKME_ANAHTARLARI: SekmeKey[] = ['ozet', 'borclar', 'gelir-gider', 'birikim']

export default function AltNavigasyon({ aktif }: { aktif: SekmeKey }) {
  const coreSekmeler = SEKMELER.filter((s) => CORE_SEKME_ANAHTARLARI.includes(s.key))
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex items-center justify-around py-1.5 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
    >
      {coreSekmeler.map((s) => (
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
      <MobilMenu aktif={aktif} />
    </nav>
  )
}
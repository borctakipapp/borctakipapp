import { monogramRengi, monogramHarfi } from '@/lib/monogram'

export default function Monogram({ isim, boyut = 40 }: { isim: string; boyut?: number }) {
  return (
    <div
      style={{ width: boyut, height: boyut, backgroundColor: monogramRengi(isim) }}
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
    >
      <span style={{ fontSize: boyut * 0.42 }}>{monogramHarfi(isim)}</span>
    </div>
  )
}
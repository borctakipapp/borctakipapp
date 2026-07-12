'use client'

type Dilim = { ad: string; tutar: number; renk: string }

// Harici kütüphaneye ihtiyaç duymadan (recharts vs. kurmana gerek kalmadan) SVG ile donut grafik.
// "stroke-dasharray" tekniği: çember çevresini 100 birim kabul edip her dilime yüzdesi kadar pay veriyoruz.
export default function PastaGrafik({ dilimler }: { dilimler: Dilim[] }) {
  const toplam = dilimler.reduce((s, d) => s + d.tutar, 0)
  const r = 15.9155
  let birikenYuzde = 0

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="transparent" stroke="#EAE6DA" strokeWidth="7" />
        {toplam > 0 && dilimler.map((d) => {
          const yuzde = (d.tutar / toplam) * 100
          const offset = 100 - birikenYuzde
          birikenYuzde += yuzde
          return (
            <circle
              key={d.ad}
              cx="21" cy="21" r={r} fill="transparent"
              stroke={d.renk} strokeWidth="7"
              strokeDasharray={`${yuzde} ${100 - yuzde}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </svg>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {dilimler.map((d) => (
          <div key={d.ad} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.renk }} />
            <span className="text-navy truncate flex-1">{d.ad}</span>
            <span className="font-mono text-muted shrink-0">
              {d.tutar.toLocaleString('tr-TR')} ₺ {toplam > 0 && `(%${Math.round((d.tutar / toplam) * 100)})`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

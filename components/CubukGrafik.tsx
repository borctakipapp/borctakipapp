type Cubuk = { etiket: string; tutar: number }

// Bağımlılıksız, hafif SVG çubuk grafik — harici kütüphane gerekmez.
export default function CubukGrafik({ veriler, renk = '#4A7C74' }: { veriler: Cubuk[]; renk?: string }) {
  const maksimum = Math.max(...veriler.map((v) => v.tutar), 1)

  return (
    <div className="flex items-end gap-2 h-32">
      {veriler.map((v) => {
        const yukseklikYuzde = Math.max(4, (v.tutar / maksimum) * 100)
        return (
          <div key={v.etiket} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-[10px] font-mono text-muted">
              {v.tutar > 0 ? v.tutar.toLocaleString('tr-TR', { maximumFractionDigits: 0, notation: v.tutar >= 10000 ? 'compact' : 'standard' }) : ''}
            </span>
            <div
              style={{ height: `${yukseklikYuzde}%`, backgroundColor: renk }}
              className="w-full rounded-t-md min-h-[4px] transition-all"
            />
            <span className="text-[10px] text-muted">{v.etiket}</span>
          </div>
        )
      })}
    </div>
  )
}

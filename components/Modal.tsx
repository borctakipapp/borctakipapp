'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({
  acik, baslik, onKapat, children,
}: {
  acik: boolean
  baslik: string
  onKapat: () => void
  children: React.ReactNode
}) {
  const icerikRef = useRef<HTMLDivElement>(null)
  const [monteEdildi, setMonteEdildi] = useState(false)
  // Metin seçmek için tıklayıp modalin dışına sürükleyince (mouseup dışarıda bitince)
  // tarayıcı bunu "arka plana tıklama" sanıp modalı kapatıyordu. mousedown'ın GERÇEKTEN
  // arka planın kendisinde başladığını ayrıca doğruluyoruz — içeride başlayan bir
  // sürükleme artık modalı kapatmıyor.
  const mouseDownHedefRef = useRef<EventTarget | null>(null)

  // Portal sadece tarayıcıda (document var olduğunda) çalışabilir — SSR'da document yok.
  useEffect(() => { setMonteEdildi(true) }, [])

  const onKapatRef = useRef(onKapat)
  useEffect(() => { onKapatRef.current = onKapat })

  useEffect(() => {
    if (!acik) return

    function tusaBasildi(e: KeyboardEvent) {
      if (e.key === 'Escape') onKapatRef.current()
    }
    document.addEventListener('keydown', tusaBasildi)

    const eskiOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const zamanlayici = setTimeout(() => icerikRef.current?.focus(), 50)

    return () => {
      document.removeEventListener('keydown', tusaBasildi)
      document.body.style.overflow = eskiOverflow
      clearTimeout(zamanlayici)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik])

  if (!acik || !monteEdildi) return null

  // React Portal: modal artık sayfanın DOM ağacındaki yerinden bağımsız, doğrudan <body>'nin
  // sonuna ekleniyor — böylece hiçbir ebeveyn elemanın (kenar çubuğu, sticky/transform vs.)
  // katman (z-index/stacking context) sorunlarından etkilenmiyor, her zaman en üstte kalıyor.
  return createPortal(
    <div
      className="fixed inset-0 bg-navy/40 flex items-end sm:items-center justify-center z-[100]"
      onMouseDown={(e) => { mouseDownHedefRef.current = e.target }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownHedefRef.current === e.currentTarget) {
          onKapat()
        }
      }}
    >
      <div
        ref={icerikRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        className="bg-paper rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-paper">
          <h2 className="text-base font-medium text-navy">{baslik}</h2>
          <button onClick={onKapat} className="text-muted hover:text-navy text-xl leading-none p-1" aria-label="Kapat">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

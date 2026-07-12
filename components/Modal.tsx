'use client'

import { useEffect, useRef } from 'react'

export default function Modal({
  acik, baslik, onKapat, children,
}: {
  acik: boolean
  baslik: string
  onKapat: () => void
  children: React.ReactNode
}) {
  const icerikRef = useRef<HTMLDivElement>(null)

  // ESC ile kapatma + arka plan kaydırmayı durdurma + odağı modal'a taşıma
  useEffect(() => {
    if (!acik) return

    function tusaBasildi(e: KeyboardEvent) {
      if (e.key === 'Escape') onKapat()
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
  }, [acik, onKapat])

  if (!acik) return null

  return (
    <div
      className="fixed inset-0 bg-navy/40 flex items-end sm:items-center justify-center z-50"
      onClick={onKapat}
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
    </div>
  )
}

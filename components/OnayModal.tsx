'use client'

import { useEffect, useRef } from 'react'

type OnayModalProps = {
  acik: boolean
  baslik: string
  mesaj: string
  onayMetni?: string
  vazgecMetni?: string
  tehlikeli?: boolean
  onOnayla: () => void
  onVazgec: () => void
}

export default function OnayModal({
  acik, baslik, mesaj, onayMetni = 'Sil', vazgecMetni = 'Vazgeç', tehlikeli = true, onOnayla, onVazgec,
}: OnayModalProps) {
  const vazgecRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!acik) return
    function tusaBasildi(e: KeyboardEvent) {
      if (e.key === 'Escape') onVazgec()
    }
    document.addEventListener('keydown', tusaBasildi)
    // Odak varsayılan olarak "Vazgeç"e gitsin — yanlışlıkla Enter'a basan biri geri dönsün, silmesin.
    const zamanlayici = setTimeout(() => vazgecRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', tusaBasildi)
      clearTimeout(zamanlayici)
    }
  }, [acik, onVazgec])

  if (!acik) return null

  return (
    <div className="fixed inset-0 bg-navy/40 flex items-center justify-center z-50 px-6" onClick={onVazgec}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={baslik}
        className="bg-white rounded-xl p-5 w-full max-w-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-medium text-navy mb-2">{baslik}</h3>
        <p className="text-sm text-muted mb-5">{mesaj}</p>
        <div className="flex gap-2">
          <button
            ref={vazgecRef}
            onClick={onVazgec}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-navy bg-paper border border-border hover:bg-border/40 transition-colors"
          >
            {vazgecMetni}
          </button>
          <button
            onClick={onOnayla}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
              tehlikeli ? 'bg-brick hover:opacity-90' : 'bg-navy hover:bg-navy-light'
            }`}
          >
            {onayMetni}
          </button>
        </div>
      </div>
    </div>
  )
}

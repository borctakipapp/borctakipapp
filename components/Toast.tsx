'use client'

import { useState, createContext, useContext, useCallback, useRef } from 'react'

type ToastMesaj = { id: number; metin: string; tur: 'basari' | 'hata' }
const ToastContext = createContext<{ goster: (metin: string, tur?: 'basari' | 'hata') => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mesajlar, setMesajlar] = useState<ToastMesaj[]>([])
  const sayacRef = useRef(0)

  const goster = useCallback((metin: string, tur: 'basari' | 'hata' = 'basari') => {
    sayacRef.current += 1
    const id = sayacRef.current
    setMesajlar((prev) => [...prev, { id, metin, tur }])
    setTimeout(() => setMesajlar((prev) => prev.filter((m) => m.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ goster }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center px-4 w-full pointer-events-none"
      >
        {mesajlar.map((m) => (
          <div
            key={m.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-lg text-sm text-white shadow-lg max-w-sm text-center animate-[fadeIn_0.15s_ease-out] ${
              m.tur === 'basari' ? 'bg-sage' : 'bg-brick'
            }`}
          >
            {m.tur === 'basari' ? '✓ ' : '⚠ '}{m.metin}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // ToastProvider dışında bir yerden çağrılırsa sessizce yut (uygulamayı kırma), sadece konsola not düş
    return { goster: (metin: string) => console.warn('Toast (provider bulunamadı):', metin) }
  }
  return ctx
}

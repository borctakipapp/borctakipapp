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

  // onKapat her render'da yeni bir referans olabilir (ebeveyn genelde inline fonksiyon veriyor).
  // Bunu doğrudan aşağıdaki effect'in bağımlılığına koyarsak, kullanıcı bir input'a her karakter
  // yazdığında (state güncellenip ebeveyn yeniden render olduğunda) effect gereksiz yere tekrar
  // çalışır ve odağı input'tan çalıp modale geri verir — bu da "her ikinci karakter kayboluyor"
  // hatasına yol açar. Ref ile sarmalayıp asıl focus/ESC effect'ini SADECE "acik" değiştiğinde
  // çalıştırıyoruz.
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
    // Bilerek sadece "acik" — modal açılınca/kapanınca bir kez çalışsın, her render'da değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik])

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

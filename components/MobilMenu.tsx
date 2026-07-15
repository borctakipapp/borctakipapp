'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { SEKMELER, type SekmeKey } from './AppHeader'
import ProfilModal from './ProfilModal'

// Alt navigasyonda YER ALMAYAN, bu menüde gösterilecek sekmeler — "core" 4 dışındaki her şey.
const MENU_SEKMELERI = SEKMELER.filter((s) => !['ozet', 'borclar', 'gelir-gider', 'birikim'].includes(s.key))

export default function MobilMenu({ aktif }: { aktif: SekmeKey }) {
  const [acik, setAcik] = useState(false)
  const [monteEdildi, setMonteEdildi] = useState(false)
  const mouseDownHedefRef = useRef<EventTarget | null>(null)

  useEffect(() => { setMonteEdildi(true) }, [])

  useEffect(() => {
    if (!acik) return
    const eskiOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function tusaBasildi(e: KeyboardEvent) { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('keydown', tusaBasildi)
    return () => {
      document.body.style.overflow = eskiOverflow
      document.removeEventListener('keydown', tusaBasildi)
    }
  }, [acik])

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] rounded-lg transition-colors ${
          MENU_SEKMELERI.some((s) => s.key === aktif) ? 'text-navy font-medium' : 'text-muted'
        }`}
        aria-label="Daha fazla"
      >
        <span className="text-lg leading-none">☰</span>
        Daha Fazla
      </button>

      {acik && monteEdildi && createPortal(
        <div
          className="fixed inset-0 bg-navy/40 z-[100] md:hidden"
          onMouseDown={(e) => { mouseDownHedefRef.current = e.target }}
          onClick={(e) => {
            if (e.target === e.currentTarget && mouseDownHedefRef.current === e.currentTarget) setAcik(false)
          }}
        >
          <div className="absolute top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-navy flex flex-col">
            <div className="px-5 py-5 flex items-center justify-between">
              <span className="text-paper font-medium text-sm tracking-wide">borctakipapp</span>
              <button onClick={() => setAcik(false)} className="text-paper/70 hover:text-paper text-xl leading-none p-1" aria-label="Kapat">×</button>
            </div>

            <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
              {MENU_SEKMELERI.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  onClick={() => setAcik(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    s.key === aktif ? 'bg-paper/10 text-paper font-medium' : 'text-paper/60 hover:bg-paper/5 hover:text-paper'
                  }`}
                >
                  <span>{s.ikon}</span>{s.etiket}
                </Link>
              ))}
            </nav>

            <div className="px-3 pb-6 flex flex-col gap-1 border-t border-paper/10 pt-3">
              <ProfilModal
                tetikleyici={
                  <button
                    onClick={() => setAcik(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-paper/60 hover:bg-paper/5 hover:text-paper transition-colors text-left"
                  >
                    <span>👤</span>Profil
                  </button>
                }
              />
              <form action="/auth/signout" method="post">
                <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-paper/60 hover:bg-paper/5 hover:text-paper transition-colors text-left">
                  <span>🚪</span>Çıkış Yap
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

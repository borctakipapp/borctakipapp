'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import BorcDetayModal from '@/components/BorcDetayModal'

type YaklasanBorc = {
  id: string
  institution_name: string
  remaining_amount: number
  due_date: string
  gunKaldi: number
}

export default function BildirimZili() {
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yaklasanlar, setYaklasanlar] = useState<YaklasanBorc[]>([])
  const kutuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchYaklasanlar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setYukleniyor(false); return }

      const { data: debts } = await supabase
        .from('debts')
        .select('id, institution_name, remaining_amount, due_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('due_date', 'is', null)

      const bugun = new Date()
      bugun.setHours(0, 0, 0, 0)

      const liste: YaklasanBorc[] = (debts || [])
        .map((d) => {
          const [y, m, gun] = d.due_date.split('-').map(Number)
          const tarih = new Date(y, m - 1, gun)
          const gunKaldi = Math.round((tarih.getTime() - bugun.getTime()) / 86400000)
          return { ...d, gunKaldi }
        })
        .filter((d) => d.gunKaldi <= 5) // bugün + geciken + 5 gün içinde olanlar
        .sort((a, b) => a.gunKaldi - b.gunKaldi)

      setYaklasanlar(liste)
      setYukleniyor(false)
    }
    fetchYaklasanlar()
  }, [])

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', disaTikla)
    return () => document.removeEventListener('mousedown', disaTikla)
  }, [])

  function gunEtiketi(gunKaldi: number) {
    if (gunKaldi < 0) return { metin: `${Math.abs(gunKaldi)} gün gecikti`, renk: 'text-brick' }
    if (gunKaldi === 0) return { metin: 'Bugün son gün', renk: 'text-brick' }
    if (gunKaldi === 1) return { metin: 'Yarın', renk: 'text-amber' }
    return { metin: `${gunKaldi} gün kaldı`, renk: 'text-amber' }
  }

  return (
    <div className="relative" ref={kutuRef}>
      <button
        onClick={() => setAcik((a) => !a)}
        className="relative p-1.5"
        aria-label="Bildirimler"
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="text-paper/80 hover:text-paper md:text-navy/70 md:hover:text-navy transition-colors"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {!yukleniyor && yaklasanlar.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brick text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
            {yaklasanlar.length}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-border z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs font-medium text-navy">Yaklaşan Ödemeler</p>
          </div>
          {yukleniyor ? (
            <p className="px-4 py-4 text-xs text-muted">Yükleniyor...</p>
          ) : yaklasanlar.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted">Yaklaşan bir ödemen yok. 🎉</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {yaklasanlar.map((y) => {
                const etiket = gunEtiketi(y.gunKaldi)
                return (
                  <div key={y.id} onClick={() => setAcik(false)} className="border-b border-border last:border-0">
                    <BorcDetayModal
                      debtId={y.id}
                      tetikleyici={
                        <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper transition-colors cursor-pointer">
                          <Monogram isim={y.institution_name} boyut={28} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-navy font-medium truncate">{y.institution_name}</p>
                            <p className={`text-[11px] ${etiket.renk}`}>{etiket.metin}</p>
                          </div>
                          <span className="font-mono text-xs text-navy shrink-0">
                            {Number(y.remaining_amount).toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

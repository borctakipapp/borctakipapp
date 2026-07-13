'use client'

import { useState } from 'react'
import Monogram from './Monogram'
import ReceivableDetayModal from './ReceivableDetayModal'

type Receivable = {
  id: string
  contact_name: string
  description: string | null
  total_amount: number
  remaining_amount: number
  expected_date: string | null
  status: 'pending' | 'completed' | 'cancelled'
  closed_at: string | null
}

const DURUM_ETIKET: Record<string, { etiket: string; renk: string }> = {
  pending: { etiket: 'Bekliyor', renk: 'bg-amber-soft text-amber' },
  completed: { etiket: 'Tamamlandı', renk: 'bg-sage-soft text-sage' },
  cancelled: { etiket: 'İptal', renk: 'bg-paper text-muted' },
}

export default function AlacaklarListesi({ receivables }: { receivables: Receivable[] }) {
  const [sekme, setSekme] = useState<'bekleyen' | 'gecmis'>('bekleyen')

  const bekleyenler = receivables
    .filter((r) => r.status === 'pending')
    .sort((a, b) => b.remaining_amount - a.remaining_amount)

  const gecmis = receivables
    .filter((r) => r.status === 'completed' || r.status === 'cancelled')
    .sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime())

  const gosterilenler = sekme === 'bekleyen' ? bekleyenler : gecmis

  return (
    <>
      <div className="flex gap-1 bg-white border border-border rounded-lg p-1 mb-4">
        <button
          onClick={() => setSekme('bekleyen')}
          className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
            sekme === 'bekleyen' ? 'bg-navy text-paper' : 'text-muted hover:bg-paper'
          }`}
        >
          Bekleyen ({bekleyenler.length})
        </button>
        <button
          onClick={() => setSekme('gecmis')}
          className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
            sekme === 'gecmis' ? 'bg-navy text-paper' : 'text-muted hover:bg-paper'
          }`}
        >
          Geçmiş ({gecmis.length})
        </button>
      </div>

      {gosterilenler.length === 0 ? (
        <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
          {receivables.length === 0
            ? 'Henüz bir alacağın yok. Birine borç verdiğinde burada takip edebilirsin.'
            : sekme === 'bekleyen'
              ? 'Şu an bekleyen bir alacağın yok 🎉'
              : 'Henüz tamamlanmış ya da iptal edilmiş bir alacağın yok'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {gosterilenler.map((r) => {
            const durum = DURUM_ETIKET[r.status]
            return (
              <ReceivableDetayModal
                key={r.id}
                receivable={r}
                tetikleyici={
                  <div className="w-full bg-white rounded-lg border border-border p-3 flex items-center gap-3 text-left hover:shadow-sm transition-shadow cursor-pointer">
                    <Monogram isim={r.contact_name} boyut={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy font-medium truncate">{r.contact_name}</p>
                      {r.description && <p className="text-xs text-muted truncate">{r.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm text-navy">{r.remaining_amount.toLocaleString('tr-TR')} ₺</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${durum.renk}`}>{durum.etiket}</span>
                    </div>
                  </div>
                }
              />
            )
          })}
        </div>
      )}
    </>
  )
}
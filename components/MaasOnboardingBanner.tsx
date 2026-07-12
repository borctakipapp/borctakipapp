'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const LS_KEY = 'maas_onboarding_kapatildi'

function bugunMetniMB() {
  const n = new Date()
  const ay = String(n.getMonth() + 1).padStart(2, '0')
  const gun = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${ay}-${gun}`
}

export default function MaasOnboardingBanner() {
  const supabase = createClient()
  const [gorunur, setGorunur] = useState(false)
  const [acik, setAcik] = useState(false)

  const [tutar, setTutar] = useState('')
  const [gun, setGun] = useState('')
  const [tip, setTip] = useState<'sabit' | 'degisken'>('sabit')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function kontrolEt() {
      if (typeof window !== 'undefined' && localStorage.getItem(LS_KEY)) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { count } = await supabase
        .from('recurring_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (!count || count === 0) setGorunur(true)
    }
    kontrolEt()
  }, [])

  function kapat() {
    localStorage.setItem(LS_KEY, '1')
    setGorunur(false)
  }

  async function handleEkle(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const t = parseFloat(tutar)
    const g = parseInt(gun)
    if (!t || t <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!g || g < 1 || g > 31) { setMessage('Ayın günü 1-31 arasında olmalı.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from('recurring_items').insert({
      user_id: user.id,
      type: 'income',
      category: 'Maaş',
      description: tip === 'degisken' ? 'Değişken tutar — her ay gerçek miktara göre düzenle' : null,
      amount: t,
      day_of_month: g,
      start_date: bugunMetniMB(),
      active: true,
    })

    setLoading(false)
    if (error) {
      setMessage('Hata: ' + error.message)
    } else {
      kapat()
    }
  }

  if (!gorunur) return null

  return (
    <div className="rounded-lg border border-navy/20 bg-white p-4 mb-6">
      {!acik ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-navy font-medium mb-1">Maaşını ekleyelim mi?</p>
              <p className="text-xs text-muted">
                Maaşını (veya düzenli gelirini) bir kere tanımlarsan, her ay elle girmene gerek kalmaz — sistem otomatik ekler,
                tarihi gelmeden "planlı gelir" olarak gösterir, "Bu Ay Net" ve tahminlerin daha doğru çıkar.
              </p>
            </div>
            <button onClick={kapat} className="text-muted text-xs shrink-0" aria-label="Kapat">✕</button>
          </div>
          <button onClick={() => setAcik(true)} className="mt-3 text-xs text-navy underline">
            Evet, ekleyeyim
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-navy font-medium mb-3">Maaş / Düzenli Gelir Ekle</p>
          <form onSubmit={handleEkle} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="number" step="0.01" placeholder="Tutar (₺)"
                value={tutar} onChange={(e) => setTutar(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
              />
              <input
                type="number" min="1" max="31" placeholder="Ayın günü"
                value={gun} onChange={(e) => setGun(e.target.value)}
                className="w-28 px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setTip('sabit')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  tip === 'sabit' ? 'bg-sage text-white' : 'bg-paper border border-border text-muted'
                }`}
              >
                Her ay sabit
              </button>
              <button
                type="button" onClick={() => setTip('degisken')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  tip === 'degisken' ? 'bg-amber text-white' : 'bg-paper border border-border text-muted'
                }`}
              >
                Değişken
              </button>
            </div>
            {tip === 'degisken' && (
              <p className="text-[11px] text-muted">
                Girdiğin tutar tahmini olur. Her ay maaşın yattığında, o ayki kaydı açıp gerçek tutarı güncelleyebilirsin.
              </p>
            )}
            <div className="flex gap-2 mt-1">
              <button
                type="submit" disabled={loading}
                className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {loading ? 'Kaydediliyor...' : 'Ekle'}
              </button>
              <button type="button" onClick={kapat} className="px-4 text-sm text-muted">
                Daha sonra
              </button>
            </div>
            {message && <p className="text-xs text-brick mt-1">{message}</p>}
          </form>
        </>
      )}
    </div>
  )
}

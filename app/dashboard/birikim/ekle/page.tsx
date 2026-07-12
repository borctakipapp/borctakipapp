'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BirikimEklePage() {
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const tutar = parseFloat(targetAmount)
    if (!tutar || tutar <= 0) {
      setMessage('Geçerli bir hedef tutar gir.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('savings_goals').insert({
      user_id: user.id,
      goal_name: goalName,
      target_amount: tutar,
      current_amount: 0,
      target_date: targetDate || null,
    })

    if (error) {
      setMessage('Hata: ' + error.message)
      setLoading(false)
    } else {
      router.push('/dashboard/birikim')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/birikim')} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Yeni Hedef Ekle</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Hedef Adı</label>
            <input
              type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} required
              placeholder="Örn: Tatil, Acil Durum Fonu, Araba Peşinatı"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Hedef Tutar (₺)</label>
            <input
              type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Hedef Tarih — opsiyonel</label>
            <input
              type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {loading ? 'Kaydediliyor...' : 'Hedefi Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>
    </div>
  )
}

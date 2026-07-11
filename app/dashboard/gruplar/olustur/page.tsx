'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GrupOlusturPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ad, setAd] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!ad.trim()) { setMessage('Grup adı gir.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı.'); setLoading(false); return }

    const { data: grup, error } = await supabase
      .from('gruplar')
      .insert({ ad: ad.trim(), olusturan_id: user.id })
      .select()
      .single()

    if (error || !grup) {
      setMessage('Hata: ' + (error?.message || 'Grup oluşturulamadı.'))
      setLoading(false)
      return
    }

    const { error: uyeError } = await supabase.from('grup_uyeler').insert({
      grup_id: grup.id,
      user_id: user.id,
      ad_soyad: user.email,
    })

    if (uyeError) {
      setMessage('Hata: ' + uyeError.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/gruplar/${grup.id}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/gruplar')} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">Yeni Grup Oluştur</h1>
        <p className="text-xs text-muted mb-6">Oluşturduktan sonra bir davet linki alacaksın, arkadaşlarına gönderip gruba katmalarını sağlayabilirsin.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Grup Adı</label>
            <input
              type="text" value={ad} onChange={(e) => setAd(e.target.value)} required
              placeholder="Örn: Kapadokya Tatili, Ev Arkadaşları"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>
    </div>
  )
}
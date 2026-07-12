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

    if (!ad.trim()) {
      setMessage('Grup adı gir.')
      return
    }

    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log('USER ERROR:', userError)
    console.log('USER:', user)

    if (!user) {
      setMessage('Oturum bulunamadı.')
      setLoading(false)
      return
    }

    const insertData = {
      ad: ad.trim(),
      olusturan_id: user.id,
    }

    console.log('INSERT DATA:', insertData)

    const { data: grup, error } = await supabase
      .from('gruplar')
      .insert(insertData)
      .select()
      .single()

    console.log('GRUP DATA:', grup)
    console.log('GRUP ERROR:', error)

    if (error || !grup) {
      setMessage('Hata: ' + (error?.message || 'Grup oluşturulamadı.'))
      setLoading(false)
      return
    }

    const uyeData = {
      grup_id: grup.id,
      user_id: user.id,
      ad_soyad: user.email,
    }

    console.log('UYE INSERT:', uyeData)

    const { error: uyeError } = await supabase
      .from('grup_uyeler')
      .insert(uyeData)

    console.log('UYE ERROR:', uyeError)

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
        <button
          onClick={() => router.push('/dashboard/gruplar')}
          className="text-paper/70 hover:text-paper text-sm"
        >
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">
          Yeni Grup Oluştur
        </h1>

        <p className="text-xs text-muted mb-6">
          Oluşturduktan sonra bir davet linki alacaksın.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">
              Grup Adı
            </label>

            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              className="w-full px-3 py-2.5 border rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-navy text-paper rounded-lg py-2.5"
          >
            {loading ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
          </button>

          {message && (
            <p className="text-red-500 text-xs">{message}</p>
          )}
        </form>
      </main>
    </div>
  )
}
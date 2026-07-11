'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SifreGuncellePage() {
  const [hazir, setHazir] = useState(false)
  const [gecersiz, setGecersiz] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function hazirla() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setGecersiz(true)
          setHazir(true)
          return
        }
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setGecersiz(true)
      }
      setHazir(true)
    }
    hazirla()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('Şifre en az 6 karakter olmalı.')
      return
    }
    if (password !== password2) {
      setMessage('Şifreler birbiriyle uyuşmuyor.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage('Hata: ' + error.message)
      setLoading(false)
    } else {
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  if (!hazir) {
    return <div className="min-h-screen bg-navy flex items-center justify-center text-paper/70 text-sm">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-paper/60 text-xs tracking-wide text-center mb-1">borctakipapp</p>
        <h1 className="text-paper text-2xl font-medium text-center mb-8">Yeni Şifre Belirle</h1>

        <div className="bg-paper rounded-xl p-6">
          {gecersiz ? (
            <p className="text-sm text-brick text-center">
              Bu link geçersiz veya süresi dolmuş. Lütfen giriş sayfasından "Şifremi Unuttum"u tekrar dene.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Yeni Şifre</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Yeni Şifre (Tekrar)</label>
                <input
                  type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
              </button>
              {message && <p className="text-xs text-brick mt-1">{message}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
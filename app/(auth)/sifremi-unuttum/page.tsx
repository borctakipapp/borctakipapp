'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [gonderildi, setGonderildi] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-guncelle`,
    })

    if (error) {
      setMessage('Hata: ' + error.message)
    } else {
      setGonderildi(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-paper/60 text-xs tracking-wide text-center mb-1">borctakipapp</p>
        <h1 className="text-paper text-2xl font-medium text-center mb-8">Şifremi Unuttum</h1>

        <div className="bg-paper rounded-xl p-6">
          {gonderildi ? (
            <div className="flex flex-col gap-3 text-center">
              <p className="text-sm text-navy">
                E-postana bir şifre sıfırlama linki gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.
              </p>
              <Link href="/login" className="text-xs text-muted underline">Giriş sayfasına dön</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-xs text-muted -mt-1 mb-1">
                Hesabına kayıtlı e-postayı gir, sana şifre sıfırlama linki gönderelim.
              </p>
              <div>
                <label className="text-xs text-muted mb-1 block">E-posta</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
              </button>
              {message && <p className="text-xs text-brick mt-1">{message}</p>}
              <Link href="/login" className="text-xs text-muted underline mt-2 text-center">Giriş sayfasına dön</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
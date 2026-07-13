'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginPageIc() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage('Hata: ' + error.message)
      } else {
        // E-posta doğrulaması kapalı olduğu için kayıt sonrası kullanıcı zaten oturum açmış oluyor
        const sonra = searchParams.get('sonra')
        router.push(sonra || '/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage('Hata: ' + error.message)
      } else {
        const sonra = searchParams.get('sonra')
        router.push(sonra || '/dashboard')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-paper/60 text-xs tracking-wide text-center mb-1">borctakipapp</p>
        <h1 className="text-paper text-2xl font-medium text-center mb-8">
          {mode === 'signin' ? 'Giriş Yap' : 'Kayıt Ol'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-paper rounded-xl p-6">
          <div>
            <label className="text-xs text-muted mb-1 block">E-posta</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted block">Şifre</label>
              {mode === 'signin' && (
                <a href="/sifremi-unuttum" className="text-[11px] text-muted underline">Şifremi unuttum</a>
              )}
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {loading ? 'Bekleyin...' : mode === 'signin' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-xs text-muted underline mt-2"
          >
            {mode === 'signin' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy" />}>
      <LoginPageIc />
    </Suspense>
  )
}

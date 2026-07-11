'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Secim from '@/components/Secim'

type Uye = { user_id: string; ad_soyad: string | null }

function bugunMetniGrup() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export default function HarcamaEklePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const grupId = params.id as string

  const [uyeler, setUyeler] = useState<Uye[]>([])
  const [odeyenId, setOdeyenId] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(bugunMetniGrup())
  const [secilenUyeler, setSecilenUyeler] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function fetchUyeler() {
      const { data } = await supabase.from('grup_uyeler').select('user_id, ad_soyad').eq('grup_id', grupId)
      setUyeler(data || [])
      setSecilenUyeler(new Set((data || []).map((u) => u.user_id)))

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setOdeyenId(user.id)
    }
    fetchUyeler()
  }, [grupId])

  function uyeSecimiDegistir(userId: string) {
    setSecilenUyeler((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const tutarSayi = parseFloat(tutar)
    if (!tutarSayi || tutarSayi <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!odeyenId) { setMessage('Kim ödediğini seç.'); return }
    if (secilenUyeler.size === 0) { setMessage('En az bir kişi arasında bölüşülmeli.'); return }

    setLoading(true)

    const { data: harcama, error } = await supabase
      .from('grup_harcamalar')
      .insert({ grup_id: grupId, odeyen_id: odeyenId, aciklama, tutar: tutarSayi, tarih })
      .select()
      .single()

    if (error || !harcama) {
      setMessage('Hata: ' + (error?.message || 'Harcama eklenemedi.'))
      setLoading(false)
      return
    }

    const kisiBasi = Math.round((tutarSayi / secilenUyeler.size) * 100) / 100
    const bolusumler = Array.from(secilenUyeler).map((uid) => ({
      harcama_id: harcama.id,
      user_id: uid,
      pay_tutari: kisiBasi,
    }))

    const { error: bolusumError } = await supabase.from('grup_harcama_bolusumu').insert(bolusumler)

    if (bolusumError) {
      setMessage('Hata: ' + bolusumError.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/gruplar/${grupId}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push(`/dashboard/gruplar/${grupId}`)} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Harcama Ekle</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Ne için?</label>
            <input type="text" value={aciklama} onChange={(e) => setAciklama(e.target.value)} required
              placeholder="Örn: Otel, Akşam Yemeği, Benzin"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Kim Ödedi</label>
            <Secim value={odeyenId} onChange={(e) => setOdeyenId(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
              {uyeler.map((u) => <option key={u.user_id} value={u.user_id}>{u.ad_soyad}</option>)}
            </Secim>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Kimler Arasında Bölüşülecek</label>
            <div className="flex flex-col gap-1.5">
              {uyeler.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 text-sm bg-white border border-border rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={secilenUyeler.has(u.user_id)} onChange={() => uyeSecimiDegistir(u.user_id)} />
                  {u.ad_soyad}
                </label>
              ))}
            </div>
            {tutar && secilenUyeler.size > 0 && (
              <p className="text-[11px] text-muted mt-1">
                Kişi başı: {(parseFloat(tutar) / secilenUyeler.size).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              </p>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Harcamayı Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>
    </div>
  )
}
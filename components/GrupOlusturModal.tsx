'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import { useToast } from './Toast'

export default function GrupOlusturModal() {
  const { goster } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function sifirlaVeKapat() {
    setAcik(false)
    setAd(''); setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!ad.trim()) { setMessage('Grup adı gir.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı.'); setLoading(false); return }

    const { data: grup, error } = await supabase.from('gruplar').insert({ ad: ad.trim(), olusturan_id: user.id }).select().single()

    if (error || !grup) {
      setMessage(error ? hataMesajiCevir(error) : 'Grup oluşturulamadı.')
      setLoading(false)
      return
    }

    const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const gorunenAd = profil?.full_name?.trim() || user.email

    const { error: uyeError } = await supabase.from('grup_uyeler').insert({ grup_id: grup.id, user_id: user.id, ad_soyad: gorunenAd })

    if (uyeError) {
      setMessage(hataMesajiCevir(uyeError))
      setLoading(false)
      return
    }

    setLoading(false)
    sifirlaVeKapat()
    goster('Grup oluşturuldu.')
    router.push(`/dashboard/gruplar/${grup.id}`)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Yeni Grup Oluştur
      </button>

      <Modal acik={acik} baslik="Yeni Grup Oluştur" onKapat={sifirlaVeKapat}>
        <p className="text-xs text-muted mb-4">Oluşturduktan sonra bir davet linki alacaksın, arkadaşlarına gönderip gruba katmalarını sağlayabilirsin.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Grup Adı</label>
            <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} required
              placeholder="Örn: Kapadokya Tatili, Ev Arkadaşları"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
          </button>
          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}
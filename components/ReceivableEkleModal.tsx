'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

export default function ReceivableEkleModal() {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [contactName, setContactName] = useState('')
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function sifirlaVeKapat() {
    setAcik(false)
    setContactName(''); setDescription(''); setTotalAmount(''); setExpectedDate(''); setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.'); return }

    const tutar = parseFloat(totalAmount)
    if (!contactName.trim()) { setMessage('Kimden alacaklı olduğunu gir.'); return }
    if (!tutar || tutar <= 0) { setMessage('Tutarı gir.'); return }

    setLoading(true)
    const { error } = await supabase.from('receivables').insert({
      user_id: user.id,
      contact_name: contactName.trim(),
      description: description.trim() || null,
      total_amount: tutar,
      remaining_amount: tutar,
      expected_date: expectedDate || null,
      status: 'pending',
    })

    if (error) {
      setMessage(hataMesajiCevir(error))
      setLoading(false)
    } else {
      setLoading(false)
      sifirlaVeKapat()
      goster('Alacak eklendi.')
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Yeni Alacak Ekle
      </button>

      <Modal acik={acik} baslik="Yeni Alacak Ekle" onKapat={sifirlaVeKapat}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Kimden Alacaklısın</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} required
              placeholder="örn. Annem"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Not (opsiyonel)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="örn. Kira depozito iadesi"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Beklenen Tarih (opsiyonel)</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Alacağı Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}
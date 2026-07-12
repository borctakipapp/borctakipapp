'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import { useToast } from './Toast'
import { kullaniciyiAdminYap } from '@/lib/admin-yetki-actions'

export default function YeniAdminEkleModal() {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [email, setEmail] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [message, setMessage] = useState('')

  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setGonderiliyor(true)
    const sonuc = await kullaniciyiAdminYap(email)
    setGonderiliyor(false)
    if (sonuc.hata) { setMessage(sonuc.hata); return }
    goster('Kullanıcı admin yapıldı. Şimdi yetkilerini "Düzenle" ile belirleyebilirsin.')
    setEmail('')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setAcik(true)}
        className="bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors">
        + Yeni Admin Ekle
      </button>

      <Modal acik={acik} baslik="Yeni Admin Ekle" onKapat={() => setAcik(false)}>
        <p className="text-xs text-muted mb-4">
          Kullanıcının zaten borctakipapp'a kayıtlı olması gerekiyor. Admin yaptıktan sonra
          yetkilerini (hangi işlemleri yapabileceğini) aşağıdan tek tek belirleyebilirsin —
          varsayılan olarak hiçbir yetkisi olmaz.
        </p>
        <form onSubmit={ekle} className="flex flex-col gap-3">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="kullanici@ornek.com"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
          />
          <button type="submit" disabled={gonderiliyor}
            className="bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {gonderiliyor ? 'Ekleniyor...' : 'Admin Yap'}
          </button>
          {message && <p className="text-xs text-brick">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import { useToast } from './Toast'
import { profilGuncelle } from '@/lib/admin-kullanici-actions'

type Profil = {
  full_name: string | null; phone: string | null; city: string | null
  gender: string | null; income_range: string | null; household_size: number | null
}

export default function AdminKullaniciDuzenleModal({ userId, profil }: { userId: string; profil: Profil | null }) {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [fullName, setFullName] = useState(profil?.full_name || '')
  const [phone, setPhone] = useState(profil?.phone || '')
  const [city, setCity] = useState(profil?.city || '')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  async function kaydet() {
    setKaydediliyor(true)
    const sonuc = await profilGuncelle(userId, { full_name: fullName, phone, city })
    setKaydediliyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Profil güncellendi.')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setAcik(true)} className="text-xs text-navy underline">Profili Düzenle</button>

      <Modal acik={acik} baslik="Kullanıcı Profilini Düzenle" onKapat={() => setAcik(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Ad Soyad</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Telefon</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Şehir</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </Modal>
    </>
  )
}

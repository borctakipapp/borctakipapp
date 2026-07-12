'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { adminYetkisiniKaldir } from '@/lib/admin-yetki-actions'

export default function AdminYetkisiKaldirButonu({ userId, email }: { userId: string; email: string }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayAcik, setOnayAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function gercekKaldir() {
    setOnayAcik(false)
    setYukleniyor(true)
    const sonuc = await adminYetkisiniKaldir(userId)
    setYukleniyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Adminlik kaldırıldı.')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOnayAcik(true)} disabled={yukleniyor} className="text-xs text-brick underline disabled:opacity-50">
        Adminlikten Çıkar
      </button>
      <OnayModal
        acik={onayAcik}
        baslik="Adminlikten çıkar"
        mesaj={`${email} artık admin panele erişemeyecek, tüm yetkileri kaldırılacak. Emin misin?`}
        onOnayla={gercekKaldir}
        onVazgec={() => setOnayAcik(false)}
      />
    </>
  )
}

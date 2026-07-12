'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { adminHarcamaSil, adminOdemeSil, adminUyeCikar, adminUyeEkle, adminGrupSil } from '@/lib/admin-grup-actions'

export function AdminHarcamaSilButonu({ harcamaId, grupId, aciklama }: { harcamaId: string; grupId: string; aciklama: string }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayAcik, setOnayAcik] = useState(false)

  async function gercekSil() {
    setOnayAcik(false)
    const sonuc = await adminHarcamaSil(harcamaId, grupId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Harcama silindi.')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOnayAcik(true)} className="text-xs text-brick underline shrink-0">Sil</button>
      <OnayModal acik={onayAcik} baslik="Harcamayı sil (Admin)" mesaj={`"${aciklama}" harcamasını kalıcı olarak silmek istediğine emin misin? Bağlı bölüşüm ve kişisel gider kayıtları da silinecek.`} onOnayla={gercekSil} onVazgec={() => setOnayAcik(false)} />
    </>
  )
}

export function AdminOdemeSilButonu({ odemeId, grupId, tutar }: { odemeId: string; grupId: string; tutar: number }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayAcik, setOnayAcik] = useState(false)

  async function gercekSil() {
    setOnayAcik(false)
    const sonuc = await adminOdemeSil(odemeId, grupId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Ödeme kaydı silindi.')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOnayAcik(true)} className="text-xs text-brick underline shrink-0">Sil</button>
      <OnayModal acik={onayAcik} baslik="Ödeme kaydını sil (Admin)" mesaj={`${tutar.toLocaleString('tr-TR')} ₺'lik mutabakat kaydını silmek istediğine emin misin? Her iki tarafın bakiyesi de değişecek, bağlı kişisel gelir/gider kayıtları da silinecek.`} onOnayla={gercekSil} onVazgec={() => setOnayAcik(false)} />
    </>
  )
}

export function AdminUyeCikarButonu({ uyelikId, grupId, ad }: { uyelikId: string; grupId: string; ad: string }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayAcik, setOnayAcik] = useState(false)

  async function gercekCikar() {
    setOnayAcik(false)
    const sonuc = await adminUyeCikar(uyelikId, grupId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster(`${ad} gruptan çıkarıldı.`)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOnayAcik(true)} className="text-xs text-brick underline shrink-0">Çıkar</button>
      <OnayModal acik={onayAcik} baslik="Üyeyi çıkar (Admin)" mesaj={`${ad} kişisini bu gruptan çıkarmak istediğine emin misin? Geçmiş harcamaları kalır, sadece erişimi kesilir.`} onOnayla={gercekCikar} onVazgec={() => setOnayAcik(false)} />
    </>
  )
}

export function AdminUyeEkleModal({ grupId }: { grupId: string }) {
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
    const sonuc = await adminUyeEkle(grupId, email)
    setGonderiliyor(false)
    if (sonuc.hata) { setMessage(sonuc.hata); return }
    goster('Üye eklendi.')
    setEmail('')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setAcik(true)} className="bg-navy text-paper text-xs font-medium rounded-lg px-3 py-2 hover:bg-navy-light transition-colors">
        + Üye Ekle
      </button>
      <Modal acik={acik} baslik="Gruba Üye Ekle (Admin)" onKapat={() => setAcik(false)}>
        <form onSubmit={ekle} className="flex flex-col gap-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="kullanici@ornek.com"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          <button type="submit" disabled={gonderiliyor}
            className="bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {gonderiliyor ? 'Ekleniyor...' : 'Ekle'}
          </button>
          {message && <p className="text-xs text-brick">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

export function AdminGrupSilButonu({ grupId, ad }: { grupId: string; ad: string }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayAcik, setOnayAcik] = useState(false)

  async function gercekSil() {
    setOnayAcik(false)
    const sonuc = await adminGrupSil(grupId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Grup silindi.')
    router.push('/admin/gruplar')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOnayAcik(true)} className="text-xs text-brick underline">Grubu Kalıcı Olarak Sil</button>
      <OnayModal acik={onayAcik} baslik="Grubu sil (Admin)" mesaj={`"${ad}" grubunu ve TÜM harcama/mesaj/ödeme geçmişini kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.`} onOnayla={gercekSil} onVazgec={() => setOnayAcik(false)} />
    </>
  )
}

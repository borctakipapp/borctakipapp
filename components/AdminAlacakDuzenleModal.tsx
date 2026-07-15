'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { alacakGuncelle, alacakSil } from '@/lib/admin-kullanici-actions'

type Alacak = { id: string; contact_name: string; remaining_amount: number; status: string }

export default function AdminAlacakDuzenleModal({ alacak, userId, tetikleyici }: { alacak: Alacak; userId: string; tetikleyici: React.ReactNode }) {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState(alacak.contact_name)
  const [tutar, setTutar] = useState(String(alacak.remaining_amount))
  const [durum, setDurum] = useState(alacak.status)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  async function kaydet() {
    setKaydediliyor(true)
    const sonuc = await alacakGuncelle(alacak.id, userId, { contact_name: ad, remaining_amount: parseFloat(tutar), status: durum })
    setKaydediliyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Alacak güncellendi.')
    setAcik(false)
    router.refresh()
  }

  async function gercekSil() {
    setOnaySilAcik(false)
    const sonuc = await alacakSil(alacak.id, userId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Alacak silindi.')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Alacağı Düzenle (Admin)" onKapat={() => setAcik(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Kişi Adı</label>
            <input type="text" value={ad} onChange={(e) => setAd(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Kalan Tutar (₺)</label>
            <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Durum</label>
            <select value={durum} onChange={(e) => setDurum(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
              <option value="pending">Bekliyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={() => setOnaySilAcik(true)}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
            Bu Alacağı Sil
          </button>
        </div>
      </Modal>

      <OnayModal
        acik={onaySilAcik}
        baslik="Alacağı sil (Admin)"
        mesaj={`${alacak.contact_name} alacağını kalıcı olarak silmek istediğine emin misin? Bu, kullanıcının verisini değiştirir.`}
        onOnayla={gercekSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

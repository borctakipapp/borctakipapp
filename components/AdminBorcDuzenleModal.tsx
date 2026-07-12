'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { borcGuncelle, borcSil } from '@/lib/admin-kullanici-actions'

type Borc = { id: string; institution_name: string; remaining_amount: number; status: string }

export default function AdminBorcDuzenleModal({ borc, userId, tetikleyici }: { borc: Borc; userId: string; tetikleyici: React.ReactNode }) {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState(borc.institution_name)
  const [tutar, setTutar] = useState(String(borc.remaining_amount))
  const [durum, setDurum] = useState(borc.status)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  async function kaydet() {
    setKaydediliyor(true)
    const sonuc = await borcGuncelle(borc.id, userId, { institution_name: ad, remaining_amount: parseFloat(tutar), status: durum })
    setKaydediliyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Borç güncellendi.')
    setAcik(false)
    router.refresh()
  }

  async function gercekSil() {
    setOnaySilAcik(false)
    const sonuc = await borcSil(borc.id, userId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Borç silindi.')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Borcu Düzenle (Admin)" onKapat={() => setAcik(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Kurum Adı</label>
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
              <option value="active">Aktif</option>
              <option value="paid">Kapandı</option>
            </select>
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={() => setOnaySilAcik(true)}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
            Bu Borcu Sil
          </button>
        </div>
      </Modal>

      <OnayModal
        acik={onaySilAcik}
        baslik="Borcu sil (Admin)"
        mesaj={`${borc.institution_name} borcunu kalıcı olarak silmek istediğine emin misin? Bu, kullanıcının verisini değiştirir.`}
        onOnayla={gercekSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

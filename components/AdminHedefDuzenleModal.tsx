'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { hedefGuncelle, hedefSil } from '@/lib/admin-kullanici-actions'

type Hedef = { id: string; goal_name: string; current_amount: number; target_amount: number }

export default function AdminHedefDuzenleModal({ hedef, userId, tetikleyici }: { hedef: Hedef; userId: string; tetikleyici: React.ReactNode }) {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState(hedef.goal_name)
  const [mevcut, setMevcut] = useState(String(hedef.current_amount))
  const [hedefTutar, setHedefTutar] = useState(String(hedef.target_amount))
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  async function kaydet() {
    setKaydediliyor(true)
    const sonuc = await hedefGuncelle(hedef.id, userId, { goal_name: ad, current_amount: parseFloat(mevcut), target_amount: parseFloat(hedefTutar) })
    setKaydediliyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Hedef güncellendi.')
    setAcik(false)
    router.refresh()
  }

  async function gercekSil() {
    setOnaySilAcik(false)
    const sonuc = await hedefSil(hedef.id, userId)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Hedef silindi.')
    setAcik(false)
    router.refresh()
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Hedefi Düzenle (Admin)" onKapat={() => setAcik(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Hedef Adı</label>
            <input type="text" value={ad} onChange={(e) => setAd(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Biriken Tutar (₺)</label>
            <input type="number" step="0.01" value={mevcut} onChange={(e) => setMevcut(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Hedef Tutar (₺)</label>
            <input type="number" step="0.01" value={hedefTutar} onChange={(e) => setHedefTutar(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={() => setOnaySilAcik(true)}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
            Bu Hedefi Sil
          </button>
        </div>
      </Modal>

      <OnayModal
        acik={onaySilAcik}
        baslik="Hedefi sil (Admin)"
        mesaj={`${hedef.goal_name} hedefini kalıcı olarak silmek istediğine emin misin? Bu, kullanıcının verisini değiştirir.`}
        onOnayla={gercekSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

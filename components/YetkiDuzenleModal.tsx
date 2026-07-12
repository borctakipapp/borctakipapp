'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import { useToast } from './Toast'
import { yetkileriGuncelle } from '@/lib/admin-yetki-actions'

const TUM_YETKILER = [
  { anahtar: 'kullanici_goruntule', etiket: 'Kullanıcıları Görüntüleme' },
  { anahtar: 'kullanici_duzenle', etiket: 'Kullanıcı Profili Düzenleme' },
  { anahtar: 'kullanici_sil', etiket: 'Kullanıcı Silme / Pasif Etme' },
  { anahtar: 'veri_mudahale', etiket: 'Kullanıcı Finansal Verisine Müdahale' },
  { anahtar: 'yetki_yonetimi', etiket: 'Yetki Yönetimi (diğer adminlere yetki verme)' },
] as const

export default function YetkiDuzenleModal({ userId, mevcutYetkiler }: { userId: string; mevcutYetkiler: string[] }) {
  const router = useRouter()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [secili, setSecili] = useState<Set<string>>(new Set(mevcutYetkiler))
  const [kaydediliyor, setKaydediliyor] = useState(false)

  function toggle(anahtar: string) {
    setSecili((prev) => {
      const next = new Set(prev)
      if (next.has(anahtar)) next.delete(anahtar); else next.add(anahtar)
      return next
    })
  }

  async function kaydet() {
    setKaydediliyor(true)
    const sonuc = await yetkileriGuncelle(userId, Array.from(secili) as any)
    setKaydediliyor(false)
    if (sonuc.hata) {
      goster(sonuc.hata, 'hata')
    } else {
      goster('Yetkiler güncellendi.')
      setAcik(false)
      router.refresh()
    }
  }

  return (
    <>
      <button onClick={() => setAcik(true)} className="text-xs text-navy underline">Düzenle</button>

      <Modal acik={acik} baslik="Yetkileri Düzenle" onKapat={() => setAcik(false)}>
        <div className="flex flex-col gap-2 mb-4">
          {TUM_YETKILER.map((y) => (
            <label key={y.anahtar} className="flex items-center gap-2 text-sm bg-white border border-border rounded-lg px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={secili.has(y.anahtar)} onChange={() => toggle(y.anahtar)} />
              {y.etiket}
            </label>
          ))}
        </div>
        <button onClick={kaydet} disabled={kaydediliyor}
          className="w-full bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
          {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </Modal>
    </>
  )
}

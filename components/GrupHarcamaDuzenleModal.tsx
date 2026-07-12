'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

type Harcama = { id: string; aciklama: string; tutar: number; tarih: string }

// Kullanım: harcama satırına bu bileşeni koy, harcama + katılanSayisi (bölüşülen kişi sayısı) prop'u geçir.
export default function GrupHarcamaDuzenleModal({
  harcama, katilanSayisi, tetikleyici,
}: {
  harcama: Harcama
  katilanSayisi: number
  tetikleyici: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [aciklama, setAciklama] = useState(harcama.aciklama)
  const [tutar, setTutar] = useState(String(harcama.tutar))
  const [tarih, setTarih] = useState(harcama.tarih)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const tutarSayi = parseFloat(tutar)
    if (!tutarSayi || tutarSayi <= 0) { setMessage('Geçerli bir tutar gir.'); return }

    setSaving(true)

    const { error: harcamaError } = await supabase
      .from('grup_harcamalar')
      .update({ aciklama, tutar: tutarSayi, tarih })
      .eq('id', harcama.id)

    if (harcamaError) { setMessage(hataMesajiCevir(harcamaError)); setSaving(false); return }

    // Bölüşüm, aynı katılımcı sayısına göre eşit olarak yeniden hesaplanıyor
    if (katilanSayisi > 0) {
      const kisiBasi = Math.round((tutarSayi / katilanSayisi) * 100) / 100
      const { error: bolusumError } = await supabase
        .from('grup_harcama_bolusumu')
        .update({ pay_tutari: kisiBasi })
        .eq('harcama_id', harcama.id)

      if (bolusumError) { setMessage(hataMesajiCevir(bolusumError)); setSaving(false); return }
    }

    // Bağlı kişisel gider kaydını da güncelle (güvenli RPC üzerinden)
    await supabase.rpc('grup_harcama_gider_guncelle', {
      p_harcama_id: harcama.id, p_tutar: tutarSayi, p_tarih: tarih, p_aciklama: `${aciklama} (Ortak Hesap)`,
    })

    setSaving(false)
    setAcik(false)
    goster('Harcama güncellendi.')
    router.refresh()
  }

  async function gercekSil() {
    setOnaySilAcik(false)
    setSaving(true)
    const { error } = await supabase.from('grup_harcamalar').delete().eq('id', harcama.id)
    setSaving(false)
    if (error) {
      goster(hataMesajiCevir(error), 'hata')
    } else {
      setAcik(false)
      goster('Harcama silindi.')
      router.refresh()
    }
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Harcamayı Düzenle" onKapat={() => setAcik(false)}>
        <form onSubmit={handleUpdate} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Ne için?</label>
            <input type="text" value={aciklama} onChange={(e) => setAciklama(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            <p className="text-[11px] text-muted mt-1">
              Tutar değişirse, {katilanSayisi} kişi arasında eşit olarak yeniden bölüşülür.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <button type="submit" disabled={saving}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
          <button type="button" onClick={() => setOnaySilAcik(true)} disabled={saving}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
            Harcamayı Sil
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>

      <OnayModal
        acik={onaySilAcik}
        baslik="Emin misin?"
        mesaj="Bu harcamayı silmek istediğine emin misin? Bölüşüm de birlikte silinecek, herkesin bakiyesi güncellenecek."
        onOnayla={gercekSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

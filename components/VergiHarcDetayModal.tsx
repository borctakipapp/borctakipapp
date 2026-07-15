'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import Secim from './Secim'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

export type VergiHarc = {
  id: string
  saglayici_adi: string | null
  category: string
  amount: number
  day_of_month: number
  fatura_dongusu: 'aylik' | 'yillik'
  fatura_ay: number | null
  active: boolean
}

const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function VergiHarcDetayModal({ kayit, tetikleyici }: { kayit: VergiHarc; tetikleyici: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [duzenleniyor, setDuzenleniyor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [onayAcik, setOnayAcik] = useState(false)
  const [message, setMessage] = useState('')

  const [tutar, setTutar] = useState(String(kayit.amount))
  const [gun, setGun] = useState(String(kayit.day_of_month))
  const [faturaDongusu, setFaturaDongusu] = useState<'aylik' | 'yillik'>(kayit.fatura_dongusu)
  const [faturaAy, setFaturaAy] = useState(String(kayit.fatura_ay || 1))

  function ac() {
    setTutar(String(kayit.amount)); setGun(String(kayit.day_of_month))
    setFaturaDongusu(kayit.fatura_dongusu); setFaturaAy(String(kayit.fatura_ay || 1))
    setDuzenleniyor(false); setMessage(''); setAcik(true)
  }

  async function kaydet() {
    setMessage('')
    const tutarSayi = parseFloat(tutar)
    const gunSayi = parseInt(gun)
    if (!tutarSayi || tutarSayi <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!gunSayi || gunSayi < 1 || gunSayi > 31) { setMessage('Ayın günü 1-31 arasında olmalı.'); return }

    setSaving(true)
    const { error } = await supabase.from('recurring_items').update({
      amount: tutarSayi,
      day_of_month: gunSayi,
      fatura_dongusu: faturaDongusu,
      fatura_ay: faturaDongusu === 'yillik' ? parseInt(faturaAy) : null,
    }).eq('id', kayit.id)

    setSaving(false)
    if (error) { setMessage(hataMesajiCevir(error)); return }
    setAcik(false)
    goster('Hatırlatıcı güncellendi.')
    router.refresh()
  }

  async function pasifAktifToggle() {
    await supabase.from('recurring_items').update({ active: !kayit.active }).eq('id', kayit.id)
    setAcik(false)
    goster(kayit.active ? 'Hatırlatıcı pasif edildi.' : 'Hatırlatıcı aktif edildi.')
    router.refresh()
  }

  async function gercekSil() {
    setOnayAcik(false)
    await supabase.from('recurring_items').delete().eq('id', kayit.id)
    setAcik(false)
    goster('Hatırlatıcı silindi.')
    router.refresh()
  }

  const baslik = kayit.saglayici_adi || kayit.category

  return (
    <>
      <span onClick={ac} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik={baslik} onKapat={() => setAcik(false)}>
        {duzenleniyor ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
              <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Tekrar Sıklığı</label>
              <Secim value={faturaDongusu} onChange={(e) => setFaturaDongusu(e.target.value as 'aylik' | 'yillik')}>
                <option value="yillik">Yıllık</option>
                <option value="aylik">Aylık</option>
              </Secim>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Ayın Günü</label>
                <input type="number" min="1" max="31" value={gun} onChange={(e) => setGun(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              </div>
              {faturaDongusu === 'yillik' && (
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Hangi Ay</label>
                  <Secim value={faturaAy} onChange={(e) => setFaturaAy(e.target.value)}>
                    {AY_ISIMLERI.map((ad, i) => <option key={ad} value={i + 1}>{ad}</option>)}
                  </Secim>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={kaydet} disabled={saving}
                className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setDuzenleniyor(false)} className="px-4 text-sm text-muted">Vazgeç</button>
            </div>
            {message && <p className="text-xs text-brick">{message}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-paper rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Tutar</p>
              <p className="font-mono text-2xl text-navy font-medium">{kayit.amount.toLocaleString('tr-TR')} ₺</p>
              <p className="text-xs text-muted mt-1">
                {kayit.fatura_dongusu === 'yillik'
                  ? `Yıllık — her yıl ${AY_ISIMLERI[(kayit.fatura_ay || 1) - 1]} ayının ${kayit.day_of_month}'i`
                  : `Aylık — her ayın ${kayit.day_of_month}'i`}
              </p>
              {!kayit.active && <p className="text-xs text-brick mt-1">Pasif</p>}
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setDuzenleniyor(true)}
                className="bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 hover:bg-paper transition-colors">
                Düzenle
              </button>
              <button onClick={pasifAktifToggle}
                className="bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 hover:bg-paper transition-colors">
                {kayit.active ? 'Pasif Et' : 'Aktif Et'}
              </button>
              <button onClick={() => setOnayAcik(true)}
                className="text-brick text-sm font-medium rounded-lg py-2 hover:underline">
                Sil
              </button>
            </div>
          </div>
        )}
      </Modal>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu hatırlatıcıyı tamamen silmek istediğine emin misin?"
        onOnayla={gercekSil}
        onVazgec={() => setOnayAcik(false)}
      />
    </>
  )
}

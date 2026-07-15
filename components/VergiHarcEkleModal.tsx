'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import Secim from './Secim'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const VERGI_HARC_TURLERI = ['MTV', 'Emlak Vergisi', 'Trafik Cezası', 'Çevre Temizlik Vergisi', 'Diğer']
const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function VergiHarcEkleModal() {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)

  const [ad, setAd] = useState(VERGI_HARC_TURLERI[0])
  const [ozelAd, setOzelAd] = useState('')
  const [tutar, setTutar] = useState('')
  const [faturaDongusu, setFaturaDongusu] = useState<'aylik' | 'yillik'>('yillik')
  const [gun, setGun] = useState('')
  const [faturaAy, setFaturaAy] = useState('1')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function sifirlaVeKapat() {
    setAcik(false)
    setAd(VERGI_HARC_TURLERI[0]); setOzelAd(''); setTutar('')
    setFaturaDongusu('yillik'); setGun(''); setFaturaAy('1'); setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.'); return }

    const gercekAd = ad === 'Diğer' ? ozelAd.trim() : ad
    const tutarSayi = parseFloat(tutar)
    const gunSayi = parseInt(gun)
    if (!gercekAd) { setMessage('Vergi/harç adını gir.'); return }
    if (!tutarSayi || tutarSayi <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!gunSayi || gunSayi < 1 || gunSayi > 31) { setMessage('Ayın günü 1-31 arasında olmalı.'); return }

    setLoading(true)
    const { error } = await supabase.from('recurring_items').insert({
      user_id: user.id,
      type: 'expense',
      category: 'Vergi/Harç',
      description: null,
      amount: tutarSayi,
      day_of_month: gunSayi,
      active: true,
      vergi_harc_mi: true,
      saglayici_adi: gercekAd,
      fatura_dongusu: faturaDongusu,
      fatura_ay: faturaDongusu === 'yillik' ? parseInt(faturaAy) : null,
      iptal_hatirlatma_gun: null,
    })

    if (error) {
      setMessage(hataMesajiCevir(error))
      setLoading(false)
    } else {
      setLoading(false)
      sifirlaVeKapat()
      goster('Vergi/Harç hatırlatıcısı eklendi.')
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Yeni Hatırlatıcı Ekle
      </button>

      <Modal acik={acik} baslik="Vergi/Harç Hatırlatıcısı Ekle" onKapat={sifirlaVeKapat}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Tür</label>
            <Secim value={ad} onChange={(e) => setAd(e.target.value)}>
              {VERGI_HARC_TURLERI.map((k) => <option key={k} value={k}>{k}</option>)}
            </Secim>
          </div>

          {ad === 'Diğer' && (
            <div>
              <label className="text-xs text-muted mb-1 block">Adı</label>
              <input type="text" value={ozelAd} onChange={(e) => setOzelAd(e.target.value)} required
                placeholder="örn. İSKİ Su Faturası"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} required
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
              <input type="number" min="1" max="31" value={gun} onChange={(e) => setGun(e.target.value)} required
                placeholder="örn. 31"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
            {faturaDongusu === 'yillik' && (
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Hangi Ay</label>
                <Secim value={faturaAy} onChange={(e) => setFaturaAy(e.target.value)}>
                  {AY_ISIMLERI.map((ad2, i) => <option key={ad2} value={i + 1}>{ad2}</option>)}
                </Secim>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Hatırlatıcıyı Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

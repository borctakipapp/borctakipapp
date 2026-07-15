'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import Secim from './Secim'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const ABONELIK_KATEGORILERI = ['Eğlence', 'Kişisel Bakım', 'Eğitim', 'Sağlık', 'Diğer Gider']
const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function AbonelikEkleModal() {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)

  const [saglayiciAdi, setSaglayiciAdi] = useState('')
  const [kategori, setKategori] = useState(ABONELIK_KATEGORILERI[0])
  const [tutar, setTutar] = useState('')
  const [faturaDongusu, setFaturaDongusu] = useState<'aylik' | 'yillik'>('aylik')
  const [gun, setGun] = useState('')
  const [faturaAy, setFaturaAy] = useState('1')
  const [iptalHatirlatmaGun, setIptalHatirlatmaGun] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function sifirlaVeKapat() {
    setAcik(false)
    setSaglayiciAdi(''); setKategori(ABONELIK_KATEGORILERI[0]); setTutar('')
    setFaturaDongusu('aylik'); setGun(''); setFaturaAy('1'); setIptalHatirlatmaGun(''); setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.'); return }

    const tutarSayi = parseFloat(tutar)
    const gunSayi = parseInt(gun)
    if (!saglayiciAdi.trim()) { setMessage('Sağlayıcı adını gir (örn. Netflix).'); return }
    if (!tutarSayi || tutarSayi <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!gunSayi || gunSayi < 1 || gunSayi > 31) { setMessage('Ayın günü 1-31 arasında olmalı.'); return }

    const hatirlatmaSayi = iptalHatirlatmaGun ? parseInt(iptalHatirlatmaGun) : null
    if (iptalHatirlatmaGun && (!hatirlatmaSayi || hatirlatmaSayi < 1)) {
      setMessage('İptal hatırlatma günü pozitif bir sayı olmalı (boş bırakırsan varsayılan 5 gün kullanılır).')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('recurring_items').insert({
      user_id: user.id,
      type: 'expense',
      category: kategori,
      description: null,
      amount: tutarSayi,
      day_of_month: gunSayi,
      active: true,
      abonelik_mi: true,
      saglayici_adi: saglayiciAdi.trim(),
      fatura_dongusu: faturaDongusu,
      fatura_ay: faturaDongusu === 'yillik' ? parseInt(faturaAy) : null,
      iptal_hatirlatma_gun: hatirlatmaSayi,
    })

    if (error) {
      setMessage(hataMesajiCevir(error))
      setLoading(false)
    } else {
      setLoading(false)
      sifirlaVeKapat()
      goster('Abonelik eklendi.')
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Yeni Abonelik Ekle
      </button>

      <Modal acik={acik} baslik="Yeni Abonelik Ekle" onKapat={sifirlaVeKapat}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Sağlayıcı Adı</label>
            <input type="text" value={saglayiciAdi} onChange={(e) => setSaglayiciAdi(e.target.value)} required
              placeholder="örn. Netflix, Spotify"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Kategori</label>
            <Secim value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {ABONELIK_KATEGORILERI.map((k) => <option key={k} value={k}>{k}</option>)}
            </Secim>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Fatura Döngüsü</label>
            <Secim value={faturaDongusu} onChange={(e) => setFaturaDongusu(e.target.value as 'aylik' | 'yillik')}>
              <option value="aylik">Aylık</option>
              <option value="yillik">Yıllık</option>
            </Secim>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Ayın Günü</label>
              <input type="number" min="1" max="31" value={gun} onChange={(e) => setGun(e.target.value)} required
                placeholder="örn. 18"
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

          <div>
            <label className="text-xs text-muted mb-1 block">İptal Hatırlatma (opsiyonel, gün)</label>
            <input type="number" min="1" value={iptalHatirlatmaGun} onChange={(e) => setIptalHatirlatmaGun(e.target.value)}
              placeholder="Boş bırakırsan 5 gün kala hatırlatılır"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Aboneliği Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

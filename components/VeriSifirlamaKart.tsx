'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import { useToast } from './Toast'

const ONAY_KELIMESI = 'SIFIRLA'

export default function VeriSifirlamaKart() {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [girilenKelime, setGirilenKelime] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const kelimeDogru = girilenKelime.trim().toUpperCase() === ONAY_KELIMESI

  async function sifirla() {
    if (!kelimeDogru || loading) return
    setLoading(true)
    setMessage('')

    const { error } = await supabase.rpc('tum_finansal_veriyi_sifirla')

    if (error) {
      setMessage(hataMesajiCevir(error))
      setLoading(false)
      return
    }

    goster('Tüm finansal verilerin silindi.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg border-2 border-brick p-5">
      <p className="text-sm font-medium text-brick mb-1">⚠️ Tehlikeli Bölge</p>
      <p className="text-sm text-navy font-medium mb-2">Tüm Finansal Verileri Sıfırla</p>
      <p className="text-xs text-muted mb-3">
        Bu işlem şunları <b>kalıcı ve geri döndürülemez</b> şekilde siler:
      </p>
      <ul className="text-xs text-muted list-disc list-inside mb-4 space-y-0.5">
        <li>Borçlar ve ödeme geçmişi</li>
        <li>Birikim hedefleri ve hareketleri</li>
        <li>Gelir/Gider işlemleri</li>
        <li>Bekleyen Alacaklar</li>
        <li>Düzenli işlemler ve abonelikler</li>
        <li>Bütçe limitleri</li>
      </ul>
      <p className="text-xs text-muted mb-4">
        <b>Ortak Hesap gruplarına ve Aile Bağlantılarına dokunulmaz</b> — bunlar başka
        kullanıcıları da etkiliyor, ayrı ayrı yönetilmeli.
      </p>

      <label className="text-xs text-muted mb-1 block">
        Devam etmek için kutuya <b className="font-mono">{ONAY_KELIMESI}</b> yaz
      </label>
      <input
        type="text"
        value={girilenKelime}
        onChange={(e) => setGirilenKelime(e.target.value)}
        placeholder={ONAY_KELIMESI}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono mb-3"
      />

      <button
        onClick={sifirla}
        disabled={!kelimeDogru || loading}
        className="w-full bg-brick text-white text-sm font-medium rounded-lg py-2.5 hover:bg-brick/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Siliniyor...' : 'Tüm Finansal Verilerimi Kalıcı Olarak Sil'}
      </button>

      {message && <p className="text-xs text-brick mt-2">{message}</p>}
    </div>
  )
}

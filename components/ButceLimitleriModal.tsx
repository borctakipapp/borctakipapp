'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import Skeleton from './Skeleton'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Diğer Gider']

type Limit = { category: string; aylik_limit: number }

export default function ButceLimitleriModal({ onBasarili }: { onBasarili?: () => void } = {}) {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [limitler, setLimitler] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!acik) return
    async function fetchLimitler() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('harcama_limitleri').select('category, aylik_limit').eq('user_id', user.id)
      const harita: Record<string, string> = {}
      ;(data || []).forEach((l: Limit) => { harita[l.category] = String(l.aylik_limit) })
      setLimitler(harita)
      setLoading(false)
    }
    fetchLimitler()
  }, [acik])

  async function limitKaydet(kategori: string, deger: string) {
    setSaving(kategori)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(null); return }

    const tutar = parseFloat(deger)
    if (!deger || !tutar || tutar <= 0) {
      // Boş bırakılırsa/geçersizse limiti kaldır
      const { error } = await supabase.from('harcama_limitleri').delete().eq('user_id', user.id).eq('category', kategori)
      setSaving(null)
      if (error) { goster(hataMesajiCevir(error), 'hata'); return }
      setLimitler((prev) => { const kopya = { ...prev }; delete kopya[kategori]; return kopya })
      goster(`${kategori} için limit kaldırıldı.`)
    } else {
      const { error } = await supabase.from('harcama_limitleri').upsert({ user_id: user.id, category: kategori, aylik_limit: tutar }, { onConflict: 'user_id,category' })
      setSaving(null)
      if (error) { goster(hataMesajiCevir(error), 'hata'); return }
      goster(`${kategori} limiti kaydedildi.`)
    }
    onBasarili ? onBasarili() : router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="bg-white border border-border text-navy text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-paper transition-colors"
      >
        🎯 Bütçe Limitleri
      </button>

      <Modal acik={acik} baslik="Kategori Bazlı Bütçe Limitleri" onKapat={() => setAcik(false)}>
        <p className="text-xs text-muted mb-4">
          Bir kategoriye aylık üst sınır koy — o kategoride harcaman sınıra yaklaşınca Gelir-Gider sayfasında uyarı görürsün. Boş bırakırsan limit uygulanmaz.
        </p>
        {loading ? (
          <Skeleton satirlar={4} />
        ) : (
          <div className="flex flex-col gap-3">
            {GIDER_KATEGORILERI.map((kategori) => (
              <div key={kategori} className="flex items-center gap-3">
                <label className="text-sm text-navy flex-1">{kategori}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" step="50"
                    value={limitler[kategori] || ''}
                    onChange={(e) => setLimitler((prev) => ({ ...prev, [kategori]: e.target.value }))}
                    onBlur={(e) => limitKaydet(kategori, e.target.value)}
                    placeholder="Yok"
                    className="w-24 px-2 py-1.5 border border-border rounded-lg text-sm bg-white font-mono text-right"
                  />
                  <span className="text-xs text-muted">₺</span>
                  {saving === kategori && <span className="text-[10px] text-muted">...</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}

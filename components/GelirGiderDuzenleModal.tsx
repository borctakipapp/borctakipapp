'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Secim from './Secim'
import Modal from './Modal'
import OnayModal from './OnayModal'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const GELIR_KATEGORILERI = ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Yatırım Geliri', 'Birikimden Çekim', 'Diğer Gelir']
const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Birikim Aktarımı', 'Diğer Gider']

function bugun() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

// Kullanım: her işlem satırındaki kalem ikonuna bu bileşeni koy, txId prop'u geçir.
export default function GelirGiderDuzenleModal({ txId, onBasarili }: { txId: string; onBasarili?: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [onayAcik, setOnayAcik] = useState(false)
  const [message, setMessage] = useState('')

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(bugun())
  const [isRecurring, setIsRecurring] = useState(false)

  const kategoriler = type === 'income' ? GELIR_KATEGORILERI : GIDER_KATEGORILERI

  useEffect(() => {
    if (!acik) return
    async function fetchTx() {
      setLoading(true)
      const { data, error } = await supabase.from('transactions').select('*').eq('id', txId).single()
      if (data) {
        setType(data.type); setCategory(data.category); setDescription(data.description || '')
        setAmount(String(data.amount)); setDate(data.transaction_date); setIsRecurring(!!data.is_recurring)
      }
      if (error) setMessage('Kayıt bulunamadı.')
      setLoading(false)
    }
    fetchTx()
  }, [acik, txId])

  function handleTypeChange(yeniTip: 'income' | 'expense') {
    setType(yeniTip)
    const liste = yeniTip === 'income' ? GELIR_KATEGORILERI : GIDER_KATEGORILERI
    if (!liste.includes(category)) setCategory(liste[0])
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (date > bugun()) { setMessage('Gelecek bir tarih girilemez.'); return }
    const tutar = parseFloat(amount)
    if (!tutar || tutar <= 0) { setMessage('Geçerli bir tutar gir.'); return }

    setSaving(true)
    const { error } = await supabase.from('transactions').update({
      type, category, amount: tutar, transaction_date: date, description: description || null, is_recurring: isRecurring,
    }).eq('id', txId)

    if (error) {
      setMessage(hataMesajiCevir(error))
      setSaving(false)
    } else {
      setSaving(false)
      setAcik(false)
      ;(onBasarili ? onBasarili() : router.refresh())
    }
  }

  async function gercekSil() {
    setOnayAcik(false)
    setSaving(true)
    const { error } = await supabase.from('transactions').delete().eq('id', txId)
    if (error) {
      setMessage(hataMesajiCevir(error))
      setSaving(false)
    } else {
      setSaving(false)
      setAcik(false)
      ;(onBasarili ? onBasarili() : router.refresh())
    }
  }

  return (
    <>
      <button onClick={() => setAcik(true)} className="shrink-0 text-muted hover:text-navy p-1" aria-label="Düzenle">✎</button>

      <Modal acik={acik} baslik="Kaydı Düzenle" onKapat={() => setAcik(false)}>
        {loading ? (
          <p className="text-sm text-muted text-center py-6">Yükleniyor...</p>
        ) : (
          <form onSubmit={handleUpdate} className="flex flex-col gap-3">
            <div className="flex gap-2 mb-1">
              <button type="button" onClick={() => handleTypeChange('expense')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${type === 'expense' ? 'bg-brick text-white' : 'bg-white border border-border text-muted'}`}>
                Gider
              </button>
              <button type="button" onClick={() => handleTypeChange('income')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${type === 'income' ? 'bg-sage text-white' : 'bg-white border border-border text-muted'}`}>
                Gelir
              </button>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Kategori</label>
              <Secim value={category} onChange={(e) => setCategory(e.target.value)}>
                {kategoriler.map((k) => <option key={k} value={k}>{k}</option>)}
              </Secim>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Kaynak / Açıklama — opsiyonel</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Tarih</label>
              <input type="date" value={date} max={bugun()} onChange={(e) => setDate(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted mt-1">
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              Bu tekrarlayan bir işlem (örn. maaş, kira geliri)
            </label>

            <button type="submit" disabled={saving}
              className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>

            <button type="button" onClick={() => setOnayAcik(true)} disabled={saving}
              className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
              Kaydı Sil
            </button>

            {message && <p className="text-xs text-brick mt-1">{message}</p>}
          </form>
        )}
      </Modal>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu kaydı silmek istediğine emin misin?"
        onOnayla={gercekSil}
        onVazgec={() => setOnayAcik(false)}
      />
    </>
  )
}

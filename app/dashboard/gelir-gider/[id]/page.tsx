'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'
import Secim from '@/components/Secim'

const GELIR_KATEGORILERI = ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Yatırım Geliri', 'Birikimden Çekim', 'Diğer Gelir']
const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Birikim Aktarımı', 'Diğer Gider']

function bugun() {
  // ÖNEMLİ: toISOString UTC'ye çevirir, saat dilimine göre günü kaydırabilir. Yerel tarihi manuel inşa ediyoruz.
  const n = new Date()
  const ay = String(n.getMonth() + 1).padStart(2, '0')
  const gun = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${ay}-${gun}`
}

function GelirGiderDetayPageIc() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string
  const searchParams = useSearchParams()
  const ayParam = searchParams.get('ay')
  const yilParam = searchParams.get('yil')
  const geriDonUrl = ayParam !== null && yilParam !== null
    ? `/dashboard/gelir-gider?ay=${ayParam}&yil=${yilParam}`
    : '/dashboard/gelir-gider'

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
    async function fetchTx() {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single()
      if (data) {
        setType(data.type)
        setCategory(data.category)
        setDescription(data.description || '')
        setAmount(String(data.amount))
        setDate(data.transaction_date)
        setIsRecurring(!!data.is_recurring)
      }
      if (error) setMessage('Kayıt bulunamadı.')
      setLoading(false)
    }
    fetchTx()
  }, [id])

  function handleTypeChange(yeniTip: 'income' | 'expense') {
    setType(yeniTip)
    const liste = yeniTip === 'income' ? GELIR_KATEGORILERI : GIDER_KATEGORILERI
    if (!liste.includes(category)) setCategory(liste[0])
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (date > bugun()) {
      setMessage('Gelecek bir tarih girilemez.')
      return
    }
    const tutar = parseFloat(amount)
    if (!tutar || tutar <= 0) {
      setMessage('Geçerli bir tutar gir.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('transactions').update({
      type,
      category,
      amount: tutar,
      transaction_date: date,
      description: description || null,
      is_recurring: isRecurring,
    }).eq('id', id)

    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push(geriDonUrl)
      router.refresh()
    }
  }

  function handleDelete() {
    setOnayAcik(true)
  }

  async function gercekSil() {
    setOnayAcik(false)
    setSaving(true)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push(geriDonUrl)
      router.refresh()
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push(geriDonUrl)} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Kaydı Düzenle</h1>

        <form onSubmit={handleUpdate} className="flex flex-col gap-3">

          <div className="flex gap-2 mb-1">
            <button
              type="button" onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                type === 'expense' ? 'bg-brick text-white' : 'bg-white border border-border text-muted'
              }`}
            >
              Gider
            </button>
            <button
              type="button" onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                type === 'income' ? 'bg-sage text-white' : 'bg-white border border-border text-muted'
              }`}
            >
              Gelir
            </button>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Kategori</label>
            <Secim value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
              {kategoriler.map((k) => <option key={k} value={k}>{k}</option>)}
            </Secim>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Kaynak / Açıklama — opsiyonel</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input
              type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tarih</label>
            <input
              type="date" value={date} max={bugun()} onChange={(e) => setDate(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted mt-1">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Bu tekrarlayan bir işlem (örn. maaş, kira geliri)
          </label>

          <button
            type="submit" disabled={saving}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>

          <button
            type="button" onClick={handleDelete} disabled={saving}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity"
          >
            Kaydı Sil
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu kaydı silmek istediğine emin misin?"
        onOnayla={gercekSil}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}

export default function GelirGiderDetayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>}>
      <GelirGiderDetayPageIc />
    </Suspense>
  )
}

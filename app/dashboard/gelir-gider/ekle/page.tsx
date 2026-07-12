'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

function ikiBasamak(n: number) {
  return String(n).padStart(2, '0')
}

function GelirGiderEklePageIc() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const ayParam = searchParams.get('ay')
  const yilParam = searchParams.get('yil')
  const hedefAy = ayParam !== null ? parseInt(ayParam) : null
  const hedefYil = yilParam !== null ? parseInt(yilParam) : null

  // Görüntülenen ay şimdiki aydan farklıysa, tarihi o ayın içinden başlat.
  function varsayilanTarih() {
    const su = new Date()
    if (hedefAy === null || hedefYil === null) return bugun()
    if (hedefAy === su.getMonth() && hedefYil === su.getFullYear()) return bugun()
    if (hedefYil > su.getFullYear() || (hedefYil === su.getFullYear() && hedefAy > su.getMonth())) return bugun() // gelecek ay olamaz, güvenlik
    return `${hedefYil}-${ikiBasamak(hedefAy + 1)}-01`
  }

  // Tarih alanının izin verdiği aralık: görüntülenen ayın içi (geçmiş bir ay ise tüm ay; şu anki ay ise bugüne kadar)
  function tarihSinirlari() {
    const su = new Date()
    if (hedefAy === null || hedefYil === null) return { min: undefined, max: bugun() }
    const ayIciSonGun = new Date(hedefYil, hedefAy + 1, 0).getDate()
    const min = `${hedefYil}-${ikiBasamak(hedefAy + 1)}-01`
    const suAy = hedefAy === su.getMonth() && hedefYil === su.getFullYear()
    const max = suAy ? bugun() : `${hedefYil}-${ikiBasamak(hedefAy + 1)}-${ikiBasamak(ayIciSonGun)}`
    return { min, max }
  }

  const { min: tarihMin, max: tarihMax } = tarihSinirlari()

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState(GIDER_KATEGORILERI[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(varsayilanTarih())
  const [isRecurring, setIsRecurring] = useState(false)
  const [hedefler, setHedefler] = useState<{ id: string; goal_name: string }[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const kategoriler = type === 'income' ? GELIR_KATEGORILERI : GIDER_KATEGORILERI

  function handleTypeChange(yeniTip: 'income' | 'expense') {
    setType(yeniTip)
    setCategory(yeniTip === 'income' ? GELIR_KATEGORILERI[0] : GIDER_KATEGORILERI[0])
  }

  useEffect(() => {
    async function fetchHedefler() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('savings_goals')
        .select('id, goal_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setHedefler(data || [])
    }
    fetchHedefler()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (date > tarihMax) {
      setMessage('Gelecek bir tarih girilemez.')
      return
    }
    const tutar = parseFloat(amount)
    if (!tutar || tutar <= 0) {
      setMessage('Geçerli bir tutar gir.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.')
      setLoading(false)
      return
    }

    let recurringId: string | null = null

    if (isRecurring) {
      // Tekrarlayan işaretlendiyse, önce bir şablon (recurring_items) oluştur.
      // Şablonun "ayın kaçı"nı, seçtiğin tarihin günü belirliyor — ayrı bir alan sormaya gerek yok.
      const gun = parseInt(date.slice(8, 10))
      const { data: recItem, error: recError } = await supabase
        .from('recurring_items')
        .insert({
          user_id: user.id,
          type,
          category,
          description: description || null,
          amount: tutar,
          day_of_month: gun,
          start_date: date,
          active: true,
        })
        .select()
        .single()

      if (recError) {
        setMessage('Hata (şablon): ' + recError.message)
        setLoading(false)
        return
      }
      recurringId = recItem.id
    }

    const buAktarimHedefi = (type === 'expense' && selectedGoalId) ? selectedGoalId : null

    const { error } = await supabase.rpc('gelir_gider_ekle_ve_aktar', {
      p_user_id: user.id,
      p_type: type,
      p_category: category,
      p_amount: tutar,
      p_transaction_date: date,
      p_description: description || null,
      p_is_recurring: isRecurring,
      p_recurring_id: recurringId,
      p_goal_id: buAktarimHedefi,
      p_goal_direction: 'add',
    })

    if (error) {
      setMessage('Hata: ' + error.message)
      setLoading(false)
    } else {
      const hedefUrl = hedefAy !== null && hedefYil !== null
        ? `/dashboard/gelir-gider?ay=${hedefAy}&yil=${hedefYil}`
        : '/dashboard/gelir-gider'
      router.push(hedefUrl)
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button
          onClick={() => router.push(hedefAy !== null && hedefYil !== null ? `/dashboard/gelir-gider?ay=${hedefAy}&yil=${hedefYil}` : '/dashboard/gelir-gider')}
          className="text-paper/70 hover:text-paper text-sm"
        >
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Gelir / Gider Ekle</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

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
              placeholder={type === 'income' ? 'Örn: Daire 1 - Kadıköy' : 'Örn: Migros alışverişi'}
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
              type="date" value={date} min={tarihMin} max={tarihMax} onChange={(e) => setDate(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted mt-1 bg-white border border-border rounded-lg p-3">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5" />
            <span>
              Bu tekrarlayan bir işlem (örn. maaş, kira geliri). İşaretlersen, seçtiğin tarihin <b>günü</b> ({date.slice(8, 10)}'i) esas alınarak her ay otomatik olarak eklenir — 30/31 gibi bir gün seçersen, o günü olmayan aylarda otomatik olarak ayın son gününe düşer. İstediğin zaman "Düzenli İşlemler" sayfasından durdurabilirsin.
            </span>
          </label>

          {type === 'expense' && hedefler.length > 0 && (
            <div>
              <label className="text-xs text-muted mb-1 block">Bir birikim hedefine aktarım mı? — opsiyonel</label>
              <Secim value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
                <option value="">Hayır, sadece normal gider</option>
                {hedefler.map((h) => <option key={h.id} value={h.id}>{h.goal_name}</option>)}
              </Secim>
              {selectedGoalId && (
                <p className="text-[11px] text-sage mt-1">
                  Bu tutar kaydedilince, seçtiğin hedefe otomatik olarak eklenecek.
                </p>
              )}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>
    </div>
  )
}

export default function GelirGiderEklePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>}>
      <GelirGiderEklePageIc />
    </Suspense>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Secim from './Secim'
import Modal from './Modal'

const GELIR_KATEGORILERI = ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Yatırım Geliri', 'Birikimden Çekim', 'Diğer Gelir']
const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Birikim Aktarımı', 'Diğer Gider']

function bugun() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
function ikiBasamak(n: number) { return String(n).padStart(2, '0') }

export default function GelirGiderEkleModal({ hedefAy, hedefYil }: { hedefAy: number; hedefYil: number }) {
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)

  function varsayilanTarih() {
    const su = new Date()
    if (hedefAy === su.getMonth() && hedefYil === su.getFullYear()) return bugun()
    if (hedefYil > su.getFullYear() || (hedefYil === su.getFullYear() && hedefAy > su.getMonth())) return bugun()
    return `${hedefYil}-${ikiBasamak(hedefAy + 1)}-01`
  }
  function tarihSinirlari() {
    const su = new Date()
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
    if (!acik) return
    async function fetchHedefler() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('savings_goals').select('id, goal_name').eq('user_id', user.id).order('created_at', { ascending: false })
      setHedefler(data || [])
    }
    fetchHedefler()
    setDate(varsayilanTarih())
  }, [acik])

  function sifirlaVeKapat() {
    setAcik(false)
    setType('expense'); setCategory(GIDER_KATEGORILERI[0]); setDescription(''); setAmount('')
    setIsRecurring(false); setSelectedGoalId(''); setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (date > tarihMax) { setMessage('Gelecek bir tarih girilemez.'); return }
    const tutar = parseFloat(amount)
    if (!tutar || tutar <= 0) { setMessage('Geçerli bir tutar gir.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı.'); setLoading(false); return }

    let recurringId: string | null = null
    if (isRecurring) {
      const gun = parseInt(date.slice(8, 10))
      const { data: recItem, error: recError } = await supabase
        .from('recurring_items')
        .insert({ user_id: user.id, type, category, description: description || null, amount: tutar, day_of_month: gun, start_date: date, active: true })
        .select().single()
      if (recError) { setMessage('Hata (şablon): ' + recError.message); setLoading(false); return }
      recurringId = recItem.id
    }

    const buAktarimHedefi = (type === 'expense' && selectedGoalId) ? selectedGoalId : null

    const { error } = await supabase.rpc('gelir_gider_ekle_ve_aktar', {
      p_user_id: user.id, p_type: type, p_category: category, p_amount: tutar, p_transaction_date: date,
      p_description: description || null, p_is_recurring: isRecurring, p_recurring_id: recurringId,
      p_goal_id: buAktarimHedefi, p_goal_direction: 'add',
    })

    if (error) {
      setMessage('Hata: ' + error.message)
      setLoading(false)
    } else {
      setLoading(false)
      sifirlaVeKapat()
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Gelir / Gider Ekle
      </button>

      <Modal acik={acik} baslik="Gelir / Gider Ekle" onKapat={sifirlaVeKapat}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              placeholder={type === 'income' ? 'Örn: Daire 1 - Kadıköy' : 'Örn: Migros alışverişi'}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Tarih</label>
            <input type="date" value={date} min={tarihMin} max={tarihMax} onChange={(e) => setDate(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted mt-1 bg-paper border border-border rounded-lg p-3">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5" />
            <span>
              Bu tekrarlayan bir işlem (örn. maaş, kira geliri). Seçtiğin tarihin günü esas alınarak her ay otomatik eklenir.
            </span>
          </label>

          {type === 'expense' && hedefler.length > 0 && (
            <div>
              <label className="text-xs text-muted mb-1 block">Bir birikim hedefine aktarım mı? — opsiyonel</label>
              <Secim value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)}>
                <option value="">Hayır, sadece normal gider</option>
                {hedefler.map((h) => <option key={h.id} value={h.id}>{h.goal_name}</option>)}
              </Secim>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'

type Entry = { id: string; amount: number; type: 'add' | 'withdraw'; created_at: string }

export default function BirikimDetayPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const [entries, setEntries] = useState<Entry[]>([])
  const [entryAmount, setEntryAmount] = useState('')
  const [entryType, setEntryType] = useState<'add' | 'withdraw'>('add')
  const [addingEntry, setAddingEntry] = useState(false)
  const [gelirOlarakEkle, setGelirOlarakEkle] = useState(true)

  const [onayAcik, setOnayAcik] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: goal, error } = await supabase.from('savings_goals').select('*').eq('id', id).single()
    if (goal) {
      setGoalName(goal.goal_name)
      setTargetAmount(String(goal.target_amount))
      setCurrentAmount(String(goal.current_amount))
      setTargetDate(goal.target_date || '')
    }
    if (error) setMessage('Hedef bulunamadı.')

    const { data: entryList } = await supabase
      .from('savings_entries')
      .select('*')
      .eq('goal_id', id)
      .order('created_at', { ascending: false })
    setEntries(entryList || [])

    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  function bugunMetniBirikim() {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const tutar = parseFloat(entryAmount)
    if (!tutar || tutar <= 0) {
      setMessage('Geçerli bir tutar gir.')
      return
    }

    setAddingEntry(true)

    if (entryType === 'withdraw' && gelirOlarakEkle) {
      // Para çekme + gelir kaydı birlikte: tek atomik RPC
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setMessage('Oturum bulunamadı.'); setAddingEntry(false); return }

      const { error } = await supabase.rpc('gelir_gider_ekle_ve_aktar', {
        p_user_id: user.id,
        p_type: 'income',
        p_category: 'Birikimden Çekim',
        p_amount: tutar,
        p_transaction_date: bugunMetniBirikim(),
        p_description: goalName,
        p_is_recurring: false,
        p_recurring_id: null,
        p_goal_id: id,
        p_goal_direction: 'withdraw',
      })

      if (error) { setMessage('Hata: ' + error.message); setAddingEntry(false); return }
    } else {
      // Sadece hedefe para ekleme/çıkarma: tek atomik RPC
      const { error } = await supabase.rpc('birikim_hareket_ekle', {
        p_goal_id: id,
        p_amount: tutar,
        p_type: entryType,
      })

      if (error) { setMessage('Hata: ' + error.message); setAddingEntry(false); return }
    }

    setEntryAmount('')
    setAddingEntry(false)
    fetchData()
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('savings_goals').update({
      goal_name: goalName,
      target_amount: parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount),
      target_date: targetDate || null,
    }).eq('id', id)

    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push('/dashboard/birikim')
      router.refresh()
    }
  }

  function handleDelete() {
    setOnayAcik(true)
  }

  async function gercekSil() {
    setOnayAcik(false)
    setSaving(true)
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push('/dashboard/birikim')
      router.refresh()
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  const oran = Math.min(100, (parseFloat(currentAmount) / parseFloat(targetAmount)) * 100)
  const tamamlandi = parseFloat(currentAmount) >= parseFloat(targetAmount)

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/birikim')} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">
          {goalName}
          {tamamlandi && <span className="ml-1.5 text-xs text-sage">✓ Tamamlandı</span>}
        </h1>
        <p className="text-sm text-muted mb-2">
          <span className="font-mono text-navy">{parseFloat(currentAmount).toLocaleString('tr-TR')} ₺</span>
          {' '} / {parseFloat(targetAmount).toLocaleString('tr-TR')} ₺
        </p>
        <div className="h-2.5 bg-white border border-border rounded-full overflow-hidden mb-6">
          <div style={{ width: `${oran}%` }} className={`h-full rounded-full ${tamamlandi ? 'bg-sage' : 'bg-amber'}`} />
        </div>

        {(
          <div className="bg-sage-soft rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-sage mb-1">Manuel Kayıt Ekle / Çıkar</h2>
            <p className="text-[11px] text-muted mb-3">
              Bu, Gelir-Gider'ini etkilemez — sadece bu hedefin toplam tutarını günceller. Elindeki parayı fiilen bir gider olarak kaydetmek istiyorsan, "Gelir / Gider Ekle" formundan "birikime aktarım" seçeneğini kullan.
            </p>
            {tamamlandi && (
              <p className="text-xs text-sage mb-3">Hedefi tamamladın! İstersen fazladan eklemeye devam edebilirsin.</p>
            )}
            <form onSubmit={handleAddEntry} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button" onClick={() => setEntryType('add')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    entryType === 'add' ? 'bg-sage text-white' : 'bg-white border border-border text-muted'
                  }`}
                >
                  Para Ekle
                </button>
                <button
                  type="button" onClick={() => setEntryType('withdraw')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    entryType === 'withdraw' ? 'bg-brick text-white' : 'bg-white border border-border text-muted'
                  }`}
                >
                  Para Çek
                </button>
              </div>
              <input
                type="number" step="0.01" placeholder="Tutar (₺)"
                value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono"
              />
              {entryType === 'withdraw' && (
                <label className="flex items-start gap-2 text-xs text-muted bg-white border border-border rounded-lg p-2.5">
                  <input type="checkbox" checked={gelirOlarakEkle} onChange={(e) => setGelirOlarakEkle(e.target.checked)} className="mt-0.5" />
                  <span>Bu tutarı gelir olarak da ekle (Gelir-Gider'deki genel bakiyene geri yansısın)</span>
                </label>
              )}
              <button
                type="submit" disabled={addingEntry}
                className="bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {addingEntry ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>
        )}

        {entries.length > 0 && (
          <details className="mb-6">
            <summary className="text-sm font-medium text-muted cursor-pointer">Hareket Geçmişi ({entries.length})</summary>
            <div className="flex flex-col gap-1.5 mt-2">
              {entries.map((e) => (
                <div key={e.id} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between text-sm border border-border">
                  <span className="text-muted text-xs">{new Date(e.created_at).toLocaleDateString('tr-TR')}</span>
                  <span className={`font-mono ${e.type === 'add' ? 'text-sage' : 'text-brick'}`}>
                    {e.type === 'add' ? '+' : '−'}{Number(e.amount).toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <details className="mb-2">
          <summary className="text-sm font-medium text-muted cursor-pointer mb-3">Hedef bilgilerini düzenle</summary>

          <form onSubmit={handleUpdate} className="flex flex-col gap-3 mt-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Hedef Adı</label>
              <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Hedef Tutar (₺)</label>
              <input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Biriken Tutar (₺)</label>
              <input type="number" step="0.01" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Hedef Tarih</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>

            <button type="submit" disabled={saving}
              className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>

            <button type="button" onClick={handleDelete} disabled={saving}
              className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
              Hedefi Sil
            </button>
          </form>
        </details>

        {message && <p className="text-xs text-brick mt-2">{message}</p>}
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu hedefi silmek istediğine emin misin? Tüm hareket geçmişi de silinecek."
        onOnayla={gercekSil}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}
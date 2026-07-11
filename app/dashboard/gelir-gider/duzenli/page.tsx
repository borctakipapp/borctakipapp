'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'

const GELIR_KATEGORILERI = ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Yatırım Geliri', 'Diğer Gelir']
const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Diğer Gider']

const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function baslangicEtiketi(startDate: string) {
  const d = new Date(startDate)
  return `${AY_ISIMLERI[d.getMonth()]} ${d.getFullYear()}'den beri`
}

type RecurringItem = {
  id: string
  type: 'income' | 'expense'
  category: string
  description: string | null
  amount: number
  day_of_month: number
  active: boolean
  start_date: string
}

export default function DuzenliIslemlerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecurringItem[]>([])
  const [message, setMessage] = useState('')

  const [onayAcik, setOnayAcik] = useState(false)
  const [onayMesaj, setOnayMesaj] = useState('')
  const [onayAction, setOnayAction] = useState<(() => void) | null>(null)

  function onayTetikle(mesaj: string, action: () => void) {
    setOnayMesaj(mesaj)
    setOnayAction(() => action)
    setOnayAcik(true)
  }

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDay, setEditDay] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('user_id', user.id)
      .order('active', { ascending: false })
      .order('day_of_month', { ascending: true })

    setItems(data || [])
    setSelectedItems(new Set())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  function toggleSelection(itemId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function handleDeleteSelected() {
    if (selectedItems.size === 0) return
    onayTetikle(
      `${selectedItems.size} düzenli işlemi tamamen silmek istediğine emin misin? (Geçmişte oluşmuş kayıtlar etkilenmez.)`,
      gercekSecilenleriSil
    )
  }

  async function gercekSecilenleriSil() {
    setOnayAcik(false)
    setDeletingSelected(true)
    await supabase.from('recurring_items').delete().in('id', Array.from(selectedItems))
    setSelectedItems(new Set())
    setDeletingSelected(false)
    fetchItems()
  }

  function baslaDuzenle(item: RecurringItem) {
    setEditingId(item.id)
    setEditCategory(item.category)
    setEditDescription(item.description || '')
    setEditAmount(String(item.amount))
    setEditDay(String(item.day_of_month))
    setMessage('')
  }

  function vazgec() {
    setEditingId(null)
  }

  async function kaydetDuzenle(itemId: string, tip: 'income' | 'expense') {
    setMessage('')
    const tutar = parseFloat(editAmount)
    const gun = parseInt(editDay)
    if (!tutar || tutar <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!gun || gun < 1 || gun > 28) { setMessage('Ayın günü 1-28 arasında olmalı.'); return }

    setSaving(true)
    const { error } = await supabase.from('recurring_items').update({
      category: editCategory,
      description: editDescription || null,
      amount: tutar,
      day_of_month: gun,
    }).eq('id', itemId)

    setSaving(false)
    if (error) {
      setMessage('Hata: ' + error.message)
    } else {
      setEditingId(null)
      fetchItems()
    }
  }

  async function toggleActive(itemId: string, current: boolean) {
    await supabase.from('recurring_items').update({ active: !current }).eq('id', itemId)
    fetchItems()
  }

  function deleteItem(itemId: string) {
    onayTetikle(
      'Bu düzenli işlemi tamamen silmek istediğine emin misin? (Geçmişte oluşmuş kayıtlar etkilenmez, sadece şablon silinir.)',
      async () => {
        setOnayAcik(false)
        await supabase.from('recurring_items').delete().eq('id', itemId)
        fetchItems()
      }
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/gelir-gider')} className="text-paper/70 hover:text-paper text-sm">
          ← Geri dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-medium text-navy">Düzenli Gelir / Giderler</h1>
          {selectedItems.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="text-xs text-brick font-medium hover:underline disabled:opacity-60"
            >
              {deletingSelected ? 'Siliniyor...' : `Seçilenleri Sil (${selectedItems.size})`}
            </button>
          )}
        </div>
        <p className="text-xs text-muted mb-6">
          "Gelir / Gider Ekle" formunda "tekrarlayan işlem" kutusunu işaretleyerek eklediğin her şablon burada listelenir. Tutarını, gününü değiştirebilir, geçici olarak durdurabilir (pasif et) veya tamamen silebilirsin.
        </p>

        {items.length === 0 && (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz düzenli işlem eklemedin. Maaş veya kira gibi her ay tekrar eden bir şeyin varsa, "Gelir / Gider Ekle"den "tekrarlayan işlem" kutusunu işaretleyerek ekleyebilirsin.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const kategoriler = item.type === 'income' ? GELIR_KATEGORILERI : GIDER_KATEGORILERI
            const duzenleniyor = editingId === item.id

            if (duzenleniyor) {
              return (
                <div key={item.id} className="bg-white rounded-lg p-4 border border-navy flex flex-col gap-2.5">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Kategori</label>
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white">
                      {kategoriler.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Kaynak / Açıklama</label>
                    <input
                      type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
                      <input
                        type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted mb-1 block">Ayın Günü</label>
                      <input
                        type="number" min="1" max="31" value={editDay} onChange={(e) => setEditDay(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    Not: bu değişiklik sadece gelecekteki aylara uygulanır, geçmişte zaten oluşmuş kayıtları etkilemez.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => kaydetDuzenle(item.id, item.type)}
                      disabled={saving}
                      className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2 hover:bg-navy-light transition-colors disabled:opacity-60"
                    >
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <button onClick={vazgec} className="px-4 text-sm text-muted">Vazgeç</button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className={`bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 ${
                  item.active ? (item.type === 'income' ? 'border-sage' : 'border-brick') : 'border-border opacity-50'
                } ${selectedItems.has(item.id) ? 'ring-1 ring-brick' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">
                    {item.category}
                    {!item.active && <span className="ml-1.5 text-[10px] text-muted">(pasif)</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {item.description ? `${item.description} · ` : ''}her ayın {item.day_of_month}'i ·{' '}
                    <span className="font-mono">{Number(item.amount).toLocaleString('tr-TR')} ₺</span>
                  </p>
                  <p className="text-[11px] text-muted/70 mt-0.5">{baslangicEtiketi(item.start_date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => baslaDuzenle(item)} className="text-xs text-navy underline">Düzenle</button>
                  <button onClick={() => toggleActive(item.id, item.active)} className="text-xs text-navy underline">
                    {item.active ? 'Pasif Et' : 'Aktif Et'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-brick underline">Sil</button>
                </div>
              </div>
            )
          })}
        </div>

        {message && <p className="text-xs text-brick mt-3">{message}</p>}
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj={onayMesaj}
        onOnayla={() => onayAction && onayAction()}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}
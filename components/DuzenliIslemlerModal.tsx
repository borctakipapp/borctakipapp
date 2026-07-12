'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from './OnayModal'
import Secim from './Secim'
import Modal from './Modal'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const GELIR_KATEGORILERI = ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Yatırım Geliri', 'Diğer Gelir']
const GIDER_KATEGORILERI = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım', 'Diğer Gider']
const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function baslangicEtiketi(startDate: string) {
  const d = new Date(startDate)
  return `${AY_ISIMLERI[d.getMonth()]} ${d.getFullYear()}'den beri`
}

type RecurringItem = {
  id: string; type: 'income' | 'expense'; category: string; description: string | null
  amount: number; day_of_month: number; active: boolean; start_date: string
}

export default function DuzenliIslemlerModal({ onBasarili }: { onBasarili?: () => void } = {}) {
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecurringItem[]>([])
  const [message, setMessage] = useState('')

  const [onayAcik, setOnayAcik] = useState(false)
  const [onayMesaj, setOnayMesaj] = useState('')
  const [onayAction, setOnayAction] = useState<(() => void) | null>(null)

  function onayTetikle(mesaj: string, action: () => void) {
    setOnayMesaj(mesaj); setOnayAction(() => action); setOnayAcik(true)
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
    if (!user) return
    const { data } = await supabase.from('recurring_items').select('*').eq('user_id', user.id)
      .order('active', { ascending: false }).order('day_of_month', { ascending: true })
    setItems(data || [])
    setSelectedItems(new Set())
    setLoading(false)
  }, [])

  useEffect(() => { if (acik) fetchItems() }, [acik, fetchItems])

  function toggleSelection(itemId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      return next
    })
  }

  function handleDeleteSelected() {
    if (selectedItems.size === 0) return
    onayTetikle(`${selectedItems.size} düzenli işlemi tamamen silmek istediğine emin misin? (Geçmişte oluşmuş kayıtlar etkilenmez.)`, gercekSecilenleriSil)
  }

  async function gercekSecilenleriSil() {
    setOnayAcik(false)
    setDeletingSelected(true)
    await supabase.from('recurring_items').delete().in('id', Array.from(selectedItems))
    setSelectedItems(new Set())
    setDeletingSelected(false)
    fetchItems()
    ;(onBasarili ? onBasarili() : router.refresh())
  }

  function baslaDuzenle(item: RecurringItem) {
    setEditingId(item.id); setEditCategory(item.category); setEditDescription(item.description || '')
    setEditAmount(String(item.amount)); setEditDay(String(item.day_of_month)); setMessage('')
  }

  async function kaydetDuzenle(itemId: string) {
    setMessage('')
    const tutar = parseFloat(editAmount)
    const gun = parseInt(editDay)
    if (!tutar || tutar <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    if (!gun || gun < 1 || gun > 31) { setMessage('Ayın günü 1-31 arasında olmalı.'); return }

    setSaving(true)
    const { error } = await supabase.from('recurring_items').update({
      category: editCategory, description: editDescription || null, amount: tutar, day_of_month: gun,
    }).eq('id', itemId)

    setSaving(false)
    if (error) { setMessage(hataMesajiCevir(error)) } else { setEditingId(null); fetchItems(); (onBasarili ? onBasarili() : router.refresh()) }
  }

  async function toggleActive(itemId: string, current: boolean) {
    await supabase.from('recurring_items').update({ active: !current }).eq('id', itemId)
    fetchItems()
    ;(onBasarili ? onBasarili() : router.refresh())
  }

  function deleteItem(itemId: string) {
    onayTetikle('Bu düzenli işlemi tamamen silmek istediğine emin misin? (Geçmişte oluşmuş kayıtlar etkilenmez, sadece şablon silinir.)', async () => {
      setOnayAcik(false)
      await supabase.from('recurring_items').delete().eq('id', itemId)
      fetchItems()
      ;(onBasarili ? onBasarili() : router.refresh())
    })
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="bg-white border border-border text-navy text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-paper transition-colors"
      >
        ↻ Düzenli İşlemler
      </button>

      <Modal acik={acik} baslik="Düzenli Gelir / Giderler" onKapat={() => setAcik(false)}>
        {loading ? (
          <p className="text-sm text-muted text-center py-6">Yükleniyor...</p>
        ) : (
          <>
            {selectedItems.size > 0 && (
              <button onClick={handleDeleteSelected} disabled={deletingSelected}
                className="text-xs text-brick font-medium hover:underline disabled:opacity-60 mb-3 block">
                {deletingSelected ? 'Siliniyor...' : `Seçilenleri Sil (${selectedItems.size})`}
              </button>
            )}
            <p className="text-xs text-muted mb-4">
              "Gelir / Gider Ekle" formunda "tekrarlayan işlem" kutusunu işaretleyerek eklediğin her şablon burada listelenir.
            </p>

            {items.length === 0 && (
              <p className="text-muted text-sm bg-white border border-border rounded-lg p-4">
                Henüz düzenli işlem eklemedin.
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
                        <Secim value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                          {kategoriler.map((k) => <option key={k} value={k}>{k}</option>)}
                        </Secim>
                      </div>
                      <div>
                        <label className="text-xs text-muted mb-1 block">Kaynak / Açıklama</label>
                        <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
                          <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted mb-1 block">Ayın Günü</label>
                          <input type="number" min="1" max="31" value={editDay} onChange={(e) => setEditDay(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => kaydetDuzenle(item.id)} disabled={saving}
                          className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2 hover:bg-navy-light transition-colors disabled:opacity-60">
                          {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-4 text-sm text-muted">Vazgeç</button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={item.id}
                    className={`bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 ${
                      item.active ? (item.type === 'income' ? 'border-sage' : 'border-brick') : 'border-border opacity-50'
                    } ${selectedItems.has(item.id) ? 'ring-1 ring-brick' : ''}`}
                  >
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} className="shrink-0" />
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
                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
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
          </>
        )}
      </Modal>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj={onayMesaj}
        onOnayla={() => onayAction && onayAction()}
        onVazgec={() => setOnayAcik(false)}
      />
    </>
  )
}

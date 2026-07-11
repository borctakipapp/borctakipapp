'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'

const KATEGORILER = [
  { value: 'kredi_karti', label: 'Kredi Kartı' }, { value: 'ihtiyac_kredisi', label: 'İhtiyaç Kredisi' },
  { value: 'konut_kredisi', label: 'Konut Kredisi' }, { value: 'tasit_kredisi', label: 'Taşıt Kredisi' },
  { value: 'kisisel', label: 'Kişisel Borç' }, { value: 'taksitli_alisveris', label: 'Taksitli Alışveriş' },
  { value: 'diger', label: 'Diğer' },
]

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; kurumEtiket: string }> = {
  kredi_karti: { taksit: false, faiz: true, kurumEtiket: 'Banka / Kart Adı' },
  ihtiyac_kredisi: { taksit: true, faiz: true, kurumEtiket: 'Banka Adı' },
  konut_kredisi: { taksit: true, faiz: true, kurumEtiket: 'Banka Adı' },
  tasit_kredisi: { taksit: true, faiz: true, kurumEtiket: 'Banka Adı' },
  kisisel: { taksit: true, faiz: false, kurumEtiket: 'Kimden / Kime' },
  taksitli_alisveris: { taksit: true, faiz: false, kurumEtiket: 'Mağaza Adı' },
  diger: { taksit: true, faiz: true, kurumEtiket: 'Kurum / Kişi Adı' },
}

export default function BorcDuzenlePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [onayAcik, setOnayAcik] = useState(false)

  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<'vade_kisalsin' | 'taksit_dussun'>('vade_kisalsin')

  const fetchData = useCallback(async () => {
    const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single()
    if (debt) {
      setCategory(debt.category)
      setInstitutionName(debt.institution_name)
      setTotalAmount(String(debt.total_amount))
      setRemainingAmount(String(debt.remaining_amount))
      setInstallmentTotal(debt.installment_total ? String(debt.installment_total) : '')
      setInstallmentRemaining(debt.installment_remaining ? String(debt.installment_remaining) : '')
      setInterestRate(debt.interest_rate ? String(debt.interest_rate) : '')
      setPrincipalAmount(debt.principal_amount ? String(debt.principal_amount) : '')
      setDueDate(debt.due_date || '')
      setPrepaymentStrategy(debt.prepayment_strategy === 'taksit_dussun' ? 'taksit_dussun' : 'vade_kisalsin')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const alanlar = KATEGORI_ALANLAR[category] || { taksit: false, faiz: false, kurumEtiket: 'Kurum / Kişi Adı' }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('debts').update({
      category,
      institution_name: institutionName,
      total_amount: parseFloat(totalAmount),
      remaining_amount: parseFloat(remainingAmount),
      installment_total: alanlar.taksit && installmentTotal ? parseInt(installmentTotal) : null,
      installment_remaining: alanlar.taksit && installmentRemaining ? parseInt(installmentRemaining) : null,
      interest_rate: alanlar.faiz && interestRate ? parseFloat(interestRate) : null,
      principal_amount: principalAmount ? parseFloat(principalAmount) : null,
      due_date: dueDate || null,
      prepayment_strategy: prepaymentStrategy,
    }).eq('id', id)

    if (error) { setMessage('Hata: ' + error.message); setSaving(false) }
    else { router.push(`/dashboard/borc/${id}`); router.refresh() }
  }

  function handleDelete() { setOnayAcik(true) }
  async function gercekSil() {
    setOnayAcik(false)
    setSaving(true)
    const { error } = await supabase.from('debts').delete().eq('id', id)
    if (error) { setMessage('Hata: ' + error.message); setSaving(false) }
    else { router.push('/dashboard/borclar'); router.refresh() }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push(`/dashboard/borc/${id}`)} className="text-paper/70 hover:text-paper text-sm">
          ← Borç detayına dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Borcu Düzenle</h1>

        <form onSubmit={handleUpdate} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Borç Türü</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
              {KATEGORILER.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">{alanlar.kurumEtiket}</label>
            <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Toplam Tutar (₺)</label>
              <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Kalan Tutar (₺)</label>
              <input type="number" step="0.01" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
          </div>

          {alanlar.taksit && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Toplam Taksit</label>
                <input type="number" value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Kalan Taksit</label>
                <input type="number" value={installmentRemaining} onChange={(e) => setInstallmentRemaining(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              </div>
            </div>
          )}

          {alanlar.taksit && (
            <div>
              <label className="text-xs text-muted mb-1 block">Fazla / farklı tutar ödediğinde ne olsun?</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                  <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'vade_kisalsin'} onChange={() => setPrepaymentStrategy('vade_kisalsin')} />
                  <span><b className="text-navy">Vade kısalsın</b> — taksit tutarı sabit kalır, kalan taksit sayısı azalır.</span>
                </label>
                <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                  <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'taksit_dussun'} onChange={() => setPrepaymentStrategy('taksit_dussun')} />
                  <span><b className="text-navy">Taksit tutarı düşsün</b> — taksit sayısı aynı kalır, kalan taksitlerin tutarı küçülür.</span>
                </label>
              </div>
            </div>
          )}

          {alanlar.faiz && (
            <div>
              <label className="text-xs text-muted mb-1 block">Faiz Oranı (%, aylık)</label>
              <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
          )}

          {alanlar.faiz && alanlar.taksit && (
            <div>
              <label className="text-xs text-muted mb-1 block">Anapara (Kullanılan Kredi Tutarı) — opsiyonel</label>
              <input type="number" step="0.01" value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)}
                placeholder="Faizsiz, bankadan kullandığın gerçek tutar"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              <p className="text-[11px] text-muted mt-1">Girersen Erken Kapama Analizi çok daha doğru hesaplanır.</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">{alanlar.taksit ? 'Sıradaki Taksit Tarihi' : 'Son Ödeme Tarihi'}</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          <button type="submit" disabled={saving}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>

          <button type="button" onClick={handleDelete} disabled={saving}
            className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
            Borcu Sil
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu borcu silmek istediğine emin misin? Bu işlem geri alınamaz."
        onOnayla={gercekSil}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}
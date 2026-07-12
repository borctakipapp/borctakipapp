'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Secim from '@/components/Secim'

const KATEGORILER = [
  { value: 'kredi_karti', label: 'Kredi Kartı' },
  { value: 'ihtiyac_kredisi', label: 'İhtiyaç Kredisi' },
  { value: 'konut_kredisi', label: 'Konut Kredisi' },
  { value: 'tasit_kredisi', label: 'Taşıt Kredisi' },
  { value: 'kisisel', label: 'Kişisel Borç' },
  { value: 'taksitli_alisveris', label: 'Taksitli Alışveriş' },
  { value: 'diger', label: 'Diğer' },
]

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; tekTutar: boolean; kurumEtiket: string }> = {
  kredi_karti: { taksit: false, faiz: true, tekTutar: false, kurumEtiket: 'Banka / Kart Adı' },
  ihtiyac_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  konut_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  tasit_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  kisisel: { taksit: true, faiz: false, tekTutar: false, kurumEtiket: 'Kimden / Kime' },
  taksitli_alisveris: { taksit: true, faiz: false, tekTutar: false, kurumEtiket: 'Mağaza Adı' },
  diger: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Kurum / Kişi Adı' },
}

export default function BorcEklePage() {
  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const router = useRouter()
  const supabase = createClient()
  const alanlar = KATEGORI_ALANLAR[category]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.')
      setLoading(false)
      return
    }

    const kesinTutar = totalAmount
    const kesinKalan = alanlar.tekTutar ? totalAmount : remainingAmount

    const { error } = await supabase.from('debts').insert({
      user_id: user.id,
      category,
      institution_name: institutionName,
      total_amount: parseFloat(kesinTutar),
      remaining_amount: parseFloat(kesinKalan),
      installment_total: alanlar.taksit && installmentTotal ? parseInt(installmentTotal) : null,
      installment_remaining: alanlar.taksit && installmentRemaining ? parseInt(installmentRemaining) : null,
      interest_rate: alanlar.faiz && interestRate ? parseFloat(interestRate) : null,
      due_date: dueDate || null,
      status: 'active',
    })

    if (error) {
      setMessage('Hata: ' + error.message)
      setLoading(false)
    } else {
      router.push('/dashboard/borclar')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/borclar')} className="text-paper/70 hover:text-paper text-sm">
          ← Panele dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-6">Yeni Borç Ekle</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Borç Türü</label>
            <Secim value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
              {KATEGORILER.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Secim>
            <p className="text-[11px] text-muted mt-1">
              Kira, elektrik/su/internet faturası gibi her ay tekrar eden ödemelerin mi var? Onları buraya değil,{' '}
              <a href="/dashboard/gelir-gider/duzenli" className="underline text-navy">Gelir-Gider → Düzenli İşlemler</a>'den eklemen daha uygun olur — orada otomatik her ay görünür.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">{alanlar.kurumEtiket}</label>
            <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          {alanlar.tekTutar ? (
            <div>
              <label className="text-xs text-muted mb-1 block">Tutar (₺)</label>
              <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
          ) : (
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
          )}

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

          {alanlar.faiz && (
            <div>
              <label className="text-xs text-muted mb-1 block">Faiz Oranı (%, aylık) — opsiyonel</label>
              <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">
              {!alanlar.taksit
                ? 'Son Ödeme Tarihi'
                : (installmentTotal && installmentRemaining && parseInt(installmentRemaining) < parseInt(installmentTotal))
                  ? 'Sıradaki Taksit Tarihi'
                  : 'İlk Taksit Tarihi'}
            </label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            {alanlar.taksit && (
              <p className="text-[11px] text-muted mt-1">
                {installmentTotal && installmentRemaining && parseInt(installmentRemaining) < parseInt(installmentTotal)
                  ? 'Zaten bir kısmını ödediğin bir kredi giriyorsun — bir sonraki ödeyeceğin taksitin tarihi. Geçmiş taksitler otomatik "ödendi" görünecek.'
                  : 'İlk taksitin ne zaman ödeneceği. Diğer taksitler buradan aylık olarak otomatik ilerler.'}
              </p>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Borcu Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </main>
    </div>
  )
}

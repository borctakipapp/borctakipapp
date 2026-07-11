'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean }> = {
  kredi_karti: { taksit: false, faiz: true }, ihtiyac_kredisi: { taksit: true, faiz: true },
  konut_kredisi: { taksit: true, faiz: true }, tasit_kredisi: { taksit: true, faiz: true },
  kisisel: { taksit: true, faiz: false }, taksitli_alisveris: { taksit: true, faiz: false },
  diger: { taksit: true, faiz: true },
}

function ikiBasamak(n: number) { return String(n).padStart(2, '0') }
function tarihiAyKaydir(dateStr: string, ayFarki: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const toplamAyIndex = (y * 12 + (m - 1)) + ayFarki
  const yeniYil = Math.floor(toplamAyIndex / 12)
  const yeniAy0 = ((toplamAyIndex % 12) + 12) % 12
  const ayinSonGunu = new Date(yeniYil, yeniAy0 + 1, 0).getDate()
  const yeniGun = Math.min(d, ayinSonGunu)
  return `${yeniYil}-${ikiBasamak(yeniAy0 + 1)}-${ikiBasamak(yeniGun)}`
}

export default function BorcOdemePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const [institutionName, setInstitutionName] = useState('')
  const [category, setCategory] = useState('kredi_karti')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<'vade_kisalsin' | 'taksit_dussun'>('vade_kisalsin')

  const [selectedInstallments, setSelectedInstallments] = useState<Set<number>>(new Set())
  const [customMode, setCustomMode] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [onayAcik, setOnayAcik] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single()
    if (debt) {
      setInstitutionName(debt.institution_name)
      setCategory(debt.category)
      setTotalAmount(String(debt.total_amount))
      setRemainingAmount(String(debt.remaining_amount))
      setInstallmentTotal(debt.installment_total ? String(debt.installment_total) : '')
      setInstallmentRemaining(debt.installment_remaining ? String(debt.installment_remaining) : '')
      setDueDate(debt.due_date || '')
      setPrepaymentStrategy(debt.prepayment_strategy === 'taksit_dussun' ? 'taksit_dussun' : 'vade_kisalsin')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const alanlar = KATEGORI_ALANLAR[category] || { taksit: false, faiz: false }
  const orijinalTaksitTutari = installmentTotal && totalAmount ? parseFloat(totalAmount) / parseInt(installmentTotal) : 0
  const taksitVarMi = alanlar.taksit && installmentTotal && orijinalTaksitTutari > 0
  const tamamlananTaksitSayisi = taksitVarMi ? (parseInt(installmentTotal) - parseInt(installmentRemaining || '0')) : 0
  const taksitTutari = (() => {
    if (!taksitVarMi) return 0
    if (prepaymentStrategy === 'taksit_dussun') {
      const kalanTaksit = parseInt(installmentRemaining || '0')
      return kalanTaksit > 0 ? parseFloat(remainingAmount || '0') / kalanTaksit : 0
    }
    return orijinalTaksitTutari
  })()

  function taksitTutariHesapla(no: number) { return taksitTutari }

  const secilenToplamTutar = Array.from(selectedInstallments).reduce((sum, no) => sum + taksitTutariHesapla(no), 0)

  function toggleInstallmentSelection(no: number) {
    if (no <= tamamlananTaksitSayisi) return
    setSelectedInstallments((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no); else next.add(no)
      return next
    })
  }

  async function odemeYap(odenenTutar: number, turu: 'plan' | 'custom', taksitAdedi?: number) {
    setProcessing(true)
    setMessage('')
    setInfoMessage('')

    if (!odenenTutar || odenenTutar <= 0) {
      setMessage('Geçerli bir ödeme tutarı gir.')
      setProcessing(false)
      return
    }

    const eskiKalanTaksit = installmentRemaining ? parseInt(installmentRemaining) : null
    const yeniKalan = Math.max(0, parseFloat(remainingAmount) - odenenTutar)

    let yeniTaksitKalan: number | null = eskiKalanTaksit
    if (taksitVarMi && eskiKalanTaksit !== null) {
      if (turu === 'plan') {
        yeniTaksitKalan = Math.max(0, eskiKalanTaksit - (taksitAdedi || 0))
      } else if (prepaymentStrategy === 'vade_kisalsin') {
        yeniTaksitKalan = yeniKalan <= 0 ? 0 : Math.min(parseInt(installmentTotal), Math.ceil(yeniKalan / orijinalTaksitTutari))
      } else {
        yeniTaksitKalan = eskiKalanTaksit
      }
    }

    const { error: paymentError } = await supabase.from('payments').insert({ debt_id: id, amount: odenenTutar })
    if (paymentError) { setMessage('Hata: ' + paymentError.message); setProcessing(false); return }

    let yeniDueDate = dueDate
    if (taksitVarMi && eskiKalanTaksit !== null && yeniTaksitKalan !== null) {
      const tamamlanan = eskiKalanTaksit - yeniTaksitKalan
      if (tamamlanan > 0 && dueDate) yeniDueDate = tarihiAyKaydir(dueDate, tamamlanan)
    }

    const { error: updateError } = await supabase.from('debts').update({
      remaining_amount: yeniKalan,
      installment_remaining: yeniTaksitKalan,
      due_date: yeniDueDate || null,
      status: yeniKalan <= 0 ? 'paid' : 'active',
    }).eq('id', id)

    if (updateError) { setMessage('Hata: ' + updateError.message); setProcessing(false); return }

    setProcessing(false)
    if (yeniKalan <= 0) {
      router.push('/dashboard/borclar')
      router.refresh()
    } else {
      router.push(`/dashboard/borc/${id}`)
      router.refresh()
    }
  }

  async function handleSelectedPay() {
    await odemeYap(secilenToplamTutar, 'plan', selectedInstallments.size)
  }
  async function handleCustomPay(e: React.FormEvent) {
    e.preventDefault()
    await odemeYap(parseFloat(paymentAmount), 'custom')
  }

  function handleMarkPaid() {
    setOnayAcik(true)
  }
  async function gercekTamaminiOde() {
    setOnayAcik(false)
    setProcessing(true)
    const { error } = await supabase.from('debts').update({ status: 'paid', remaining_amount: 0 }).eq('id', id)
    setProcessing(false)
    if (error) { setMessage('Hata: ' + error.message) }
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
        <h1 className="text-xl font-medium text-navy mb-1">{institutionName}</h1>
        <p className="text-sm text-muted mb-6">Kalan: <span className="font-mono text-navy">{parseFloat(remainingAmount).toLocaleString('tr-TR')} ₺</span></p>

        {taksitVarMi && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2">Taksit seç</h2>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: parseInt(installmentTotal) }, (_, i) => i + 1).map((no) => {
                const odendi = no <= tamamlananTaksitSayisi
                const secili = selectedInstallments.has(no)
                const renk = odendi ? 'bg-sage-soft border-sage text-sage cursor-default'
                  : secili ? 'bg-navy border-navy text-paper cursor-pointer'
                  : 'bg-white border-border text-muted cursor-pointer hover:opacity-80'
                return (
                  <button type="button" key={no} onClick={() => toggleInstallmentSelection(no)} disabled={odendi}
                    className={`w-[68px] h-[68px] rounded-lg border flex flex-col items-center justify-center text-xs transition-colors ${renk}`}>
                    <span className="font-medium">{odendi ? '✓' : no}</span>
                    {!odendi && <span className="font-mono text-[10px] opacity-80">{taksitTutariHesapla(no).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺</span>}
                  </button>
                )
              })}
            </div>
            {selectedInstallments.size > 0 && (
              <button onClick={handleSelectedPay} disabled={processing}
                className="mt-3 w-full bg-sage text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60">
                {processing ? 'Kaydediliyor...' : `${selectedInstallments.size} taksiti öde — ${secilenToplamTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`}
              </button>
            )}
          </div>
        )}

        <div className="bg-sage-soft rounded-lg p-4 mb-6">
          {!customMode ? (
            <button type="button" onClick={() => setCustomMode(true)} className="text-sm font-medium text-sage underline">
              Farklı bir tutar öde
            </button>
          ) : (
            <>
              <h2 className="text-sm font-medium text-sage mb-3">Farklı bir tutar öde</h2>
              <form onSubmit={handleCustomPay} className="flex flex-col gap-2">
                <input type="number" step="0.01" placeholder="Ödenen tutar (₺)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" autoFocus />
                <div className="flex gap-2">
                  <button type="submit" disabled={processing} className="flex-1 bg-sage text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60">
                    {processing ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                  </button>
                  <button type="button" onClick={() => { setCustomMode(false); setPaymentAmount('') }} className="px-4 text-sm text-muted">Vazgeç</button>
                </div>
              </form>
            </>
          )}
        </div>

        <button onClick={handleMarkPaid} disabled={processing}
          className="w-full bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 hover:bg-paper transition-colors">
          ✓ Tamamını Ödendi Olarak İşaretle
        </button>

        {message && <p className="text-xs text-brick mt-3">{message}</p>}
        {infoMessage && <p className="text-xs text-sage mt-3 bg-white rounded-lg px-3 py-2 border border-sage/30">{infoMessage}</p>}
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj="Bu borcu tamamen ödendi olarak işaretlemek istediğine emin misin?"
        onayMetni="Evet, Ödendi"
        tehlikeli={false}
        onOnayla={gercekTamaminiOde}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}
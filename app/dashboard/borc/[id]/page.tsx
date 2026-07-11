'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'

const KATEGORILER = [
  { value: 'kredi_karti', label: 'Kredi Kartı' },
  { value: 'ihtiyac_kredisi', label: 'İhtiyaç Kredisi' },
  { value: 'konut_kredisi', label: 'Konut Kredisi' },
  { value: 'tasit_kredisi', label: 'Taşıt Kredisi' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'kira', label: 'Kira' },
  { value: 'kisisel', label: 'Kişisel Borç' },
  { value: 'taksitli_alisveris', label: 'Taksitli Alışveriş' },
  { value: 'diger', label: 'Diğer' },
]

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; tekTutar: boolean; kurumEtiket: string }> = {
  kredi_karti: { taksit: false, faiz: true, tekTutar: false, kurumEtiket: 'Banka / Kart Adı' },
  ihtiyac_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  konut_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  tasit_kredisi: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Banka Adı' },
  fatura: { taksit: false, faiz: false, tekTutar: true, kurumEtiket: 'Fatura Türü (Elektrik, Su, İnternet vb.)' },
  kira: { taksit: false, faiz: false, tekTutar: true, kurumEtiket: 'Ev Sahibi' },
  kisisel: { taksit: true, faiz: false, tekTutar: false, kurumEtiket: 'Kimden / Kime' },
  taksitli_alisveris: { taksit: true, faiz: false, tekTutar: false, kurumEtiket: 'Mağaza Adı' },
  diger: { taksit: true, faiz: true, tekTutar: false, kurumEtiket: 'Kurum / Kişi Adı' },
}

type Payment = { id: string; amount: number; paid_at: string }

function ikiBasamakBD(n: number) {
  return String(n).padStart(2, '0')
}

// Bir tarihi (YYYY-MM-DD) verilen ay kadar ileri/geri kaydırır. Saat dilimi hatasından etkilenmez (toISOString kullanmaz).
function tarihiAyKaydir(dateStr: string, ayFarki: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const toplamAyIndex = (y * 12 + (m - 1)) + ayFarki
  const yeniYil = Math.floor(toplamAyIndex / 12)
  const yeniAy0 = ((toplamAyIndex % 12) + 12) % 12
  const ayinSonGunu = new Date(yeniYil, yeniAy0 + 1, 0).getDate()
  const yeniGun = Math.min(d, ayinSonGunu)
  return `${yeniYil}-${ikiBasamakBD(yeniAy0 + 1)}-${ikiBasamakBD(yeniGun)}`
}

// Türkiye'deki tüketici kredilerinde standart yöntem: DÜZ (basit) faiz.
// Toplam Geri Ödeme = Anapara x (1 + aylık_oran x ay_sayısı), taksit tutarı buna eşit bölünür.
// Sabit taksit tutarından (P, n, M) geriye doğru düz faiz oranını buluyoruz — kapalı formül, tahmin gerekmiyor.
function taksitTenFaizOraniHesapla(P: number, n: number, M: number): number {
  if (n <= 0 || P <= 0 || M <= 0) return 0
  const oran = (M * n - P) / (P * n)
  return Math.max(0, oran)
}

export default function BorcDetayPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [status, setStatus] = useState('active')

  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<'vade_kisalsin' | 'taksit_dussun'>('vade_kisalsin')
  const [principalAmount, setPrincipalAmount] = useState('')

  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [deletingPayments, setDeletingPayments] = useState(false)

  const [onayAcik, setOnayAcik] = useState(false)
  const [onayMesaj, setOnayMesaj] = useState('')
  const [onayAction, setOnayAction] = useState<(() => void) | null>(null)

  function onayTetikle(mesaj: string, action: () => void) {
    setOnayMesaj(mesaj)
    setOnayAction(() => action)
    setOnayAcik(true)
  }

  const [selectedInstallments, setSelectedInstallments] = useState<Set<number>>(new Set())
  const [customMode, setCustomMode] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [addingPayment, setAddingPayment] = useState(false)

  const alanlar = KATEGORI_ALANLAR[category]

  // Orijinal (sabit) taksit tutarı — "vade kısalsın" stratejisinde hep bu kullanılır.
  const orijinalTaksitTutari = installmentTotal && totalAmount
    ? parseFloat(totalAmount) / parseInt(installmentTotal)
    : 0

  const taksitVarMi = alanlar.taksit && installmentTotal && orijinalTaksitTutari > 0
  const tamamlananTaksitSayisi = taksitVarMi ? (parseInt(installmentTotal) - parseInt(installmentRemaining || '0')) : 0

  // Güncel taksit tutarı: stratejiye göre sabit ya da her ödemeden sonra yeniden dağılan dinamik değer.
  const taksitTutari = (() => {
    if (!taksitVarMi) return 0
    if (prepaymentStrategy === 'taksit_dussun') {
      const kalanTaksit = parseInt(installmentRemaining || '0')
      return kalanTaksit > 0 ? parseFloat(remainingAmount || '0') / kalanTaksit : 0
    }
    return orijinalTaksitTutari
  })()

  // Kısmi ödeme kavramı sadece "vade kısalsın" stratejisinde anlamlı (taksit_dussun'de her ödeme direkt yeniden dağılıyor).
  const toplamOdenen = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, parseFloat(totalAmount || '0') - parseFloat(remainingAmount || '0'))
    : 0
  const kismiOdenenTutar = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, toplamOdenen - tamamlananTaksitSayisi * orijinalTaksitTutari)
    : 0
  const kismiKalanTutar = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, orijinalTaksitTutari - kismiOdenenTutar)
    : 0
  const siradakiTaksitTutari = kismiOdenenTutar > 0.5 ? kismiKalanTutar : taksitTutari

  function taksitTutariHesapla(no: number) {
    if (prepaymentStrategy === 'vade_kisalsin' && no === tamamlananTaksitSayisi + 1 && kismiOdenenTutar > 0.5) {
      return kismiKalanTutar
    }
    return taksitTutari
  }

  // due_date her zaman "sıradaki (tamamlananTaksitSayisi+1). taksit"in tarihini gösterir.
  // Diğer tüm taksitlerin tarihini buradan ay farkıyla hesaplıyoruz — due_date değiştikçe (ödeme yapıldıkça) otomatik güncellenir.
  function taksitTarihiHesapla(no: number): string | null {
    if (!dueDate) return null
    const offset = no - (tamamlananTaksitSayisi + 1)
    return tarihiAyKaydir(dueDate, offset)
  }

  const secilenToplamTutar = Array.from(selectedInstallments).reduce(
    (sum, no) => sum + taksitTutariHesapla(no), 0
  )

  const fetchData = useCallback(async () => {
    const { data: debt, error } = await supabase.from('debts').select('*').eq('id', id).single()
    if (debt) {
      setCategory(debt.category)
      setInstitutionName(debt.institution_name)
      setTotalAmount(String(debt.total_amount))
      setRemainingAmount(String(debt.remaining_amount))
      setInstallmentTotal(debt.installment_total ? String(debt.installment_total) : '')
      setInstallmentRemaining(debt.installment_remaining ? String(debt.installment_remaining) : '')
      setInterestRate(debt.interest_rate ? String(debt.interest_rate) : '')
      setDueDate(debt.due_date || '')
      setStatus(debt.status)
      setPrepaymentStrategy(debt.prepayment_strategy === 'taksit_dussun' ? 'taksit_dussun' : 'vade_kisalsin')
      setPrincipalAmount(debt.principal_amount ? String(debt.principal_amount) : '')
    }
    if (error) setMessage('Borç bulunamadı.')

    const { data: paymentList } = await supabase
      .from('payments')
      .select('*')
      .eq('debt_id', id)
      .order('paid_at', { ascending: false })
    setPayments(paymentList || [])
    setSelectedPayments(new Set())
    setSelectedInstallments(new Set())

    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleInstallmentSelection(no: number) {
    if (no <= tamamlananTaksitSayisi) return // ödenmiş taksit seçilemez
    setSelectedInstallments((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no)
      else next.add(no)
      return next
    })
  }

  function togglePaymentSelection(paymentId: string) {
    setSelectedPayments((prev) => {
      const next = new Set(prev)
      if (next.has(paymentId)) next.delete(paymentId)
      else next.add(paymentId)
      return next
    })
  }

  function handleDeleteSelectedPayments() {
    if (selectedPayments.size === 0) return
    onayTetikle(
      `${selectedPayments.size} ödeme kaydını silmek istediğine emin misin? Borç, bu ödemeler hiç yapılmamış gibi eski haline getirilecek.`,
      gercekOdemeleriSil
    )
  }

  async function gercekOdemeleriSil() {
    setOnayAcik(false)
    setDeletingPayments(true)
    setMessage('')
    setInfoMessage('')

    const silinecekler = payments.filter((p) => selectedPayments.has(p.id))
    const toplamGeriEklenecekTutar = silinecekler.reduce((sum, p) => sum + Number(p.amount), 0)

    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .in('id', Array.from(selectedPayments))

    if (deleteError) {
      setMessage('Hata: ' + deleteError.message)
      setDeletingPayments(false)
      return
    }

    const toplamTutar = parseFloat(totalAmount)
    const yeniKalanTutar = Math.min(
      toplamTutar || Infinity,
      parseFloat(remainingAmount) + toplamGeriEklenecekTutar
    )

    const eskiKalanTaksitSil = installmentRemaining ? parseInt(installmentRemaining) : null
    let yeniKalanTaksit = eskiKalanTaksitSil

    if (taksitVarMi && prepaymentStrategy === 'vade_kisalsin') {
      // Vade kısalsın modunda taksit sayısı, kalan tutardan güvenilir şekilde yeniden hesaplanabilir
      yeniKalanTaksit = yeniKalanTutar <= 0 ? 0 : Math.min(parseInt(installmentTotal), Math.ceil(yeniKalanTutar / orijinalTaksitTutari))
    }
    // taksit tutarı düşsün modunda: silinen ödemenin planlı mı fazladan mı olduğunu ayırt edemediğimiz için
    // taksit SAYISINI (vadeyi) değiştirmiyoruz, sadece tutar geri ekleniyor. Gerekirse "Borç bilgilerini düzenle"den elle düzeltilebilir.

    let yeniDueDateSil = dueDate
    if (taksitVarMi && prepaymentStrategy === 'vade_kisalsin' && eskiKalanTaksitSil !== null && yeniKalanTaksit !== null) {
      const fark = yeniKalanTaksit - eskiKalanTaksitSil // pozitifse taksit sayısı arttı, tarihi geriye al
      if (fark > 0 && dueDate) {
        yeniDueDateSil = tarihiAyKaydir(dueDate, -fark)
      }
    }

    const { error: updateError } = await supabase.from('debts').update({
      remaining_amount: yeniKalanTutar,
      installment_remaining: yeniKalanTaksit,
      due_date: yeniDueDateSil || null,
      status: yeniKalanTutar > 0 ? 'active' : status,
    }).eq('id', id)

    if (updateError) {
      setMessage('Hata: ' + updateError.message)
      setDeletingPayments(false)
      return
    }

    setInfoMessage(`${silinecekler.length} ödeme silindi, borç eski haline getirildi.`)
    await fetchData()
    setDeletingPayments(false)
  }

  async function odemeYap(odenenTutar: number, turu: 'plan' | 'custom', taksitAdedi?: number) {
    setAddingPayment(true)
    setMessage('')
    setInfoMessage('')

    if (!odenenTutar || odenenTutar <= 0) {
      setMessage('Geçerli bir ödeme tutarı gir.')
      setAddingPayment(false)
      return
    }

    const eskiKalanTaksit = installmentRemaining ? parseInt(installmentRemaining) : null
    const yeniKalan = Math.max(0, parseFloat(remainingAmount) - odenenTutar)

    let yeniTaksitKalan: number | null = eskiKalanTaksit

    if (taksitVarMi && eskiKalanTaksit !== null) {
      if (turu === 'plan') {
        // Plandan seçilen taksit(ler) — seçilen adet kadar kesin olarak azalt
        yeniTaksitKalan = Math.max(0, eskiKalanTaksit - (taksitAdedi || 0))
      } else if (prepaymentStrategy === 'vade_kisalsin') {
        // Fazla/farklı ödeme, vade kısalsın: taksit sayısı otomatik azalır (tutar sabit kalır)
        yeniTaksitKalan = yeniKalan <= 0 ? 0 : Math.min(parseInt(installmentTotal), Math.ceil(yeniKalan / orijinalTaksitTutari))
      } else {
        // Fazla/farklı ödeme, taksit tutarı düşsün: taksit SAYISI (vade) değişmez, sadece tutar düşer
        yeniTaksitKalan = eskiKalanTaksit
      }
    }

    const { error: paymentError } = await supabase.from('payments').insert({
      debt_id: id,
      amount: odenenTutar,
    })

    if (paymentError) {
      setMessage('Hata: ' + paymentError.message)
      setAddingPayment(false)
      return
    }

    // Taksit sayısı gerçekten azaldıysa, "sıradaki ödeme tarihi"ni de o kadar ay ileri al
    let yeniDueDate = dueDate
    if (taksitVarMi && eskiKalanTaksit !== null && yeniTaksitKalan !== null) {
      const tamamlanan = eskiKalanTaksit - yeniTaksitKalan
      if (tamamlanan > 0 && dueDate) {
        yeniDueDate = tarihiAyKaydir(dueDate, tamamlanan)
      }
    }

    const { error: updateError } = await supabase.from('debts').update({
      remaining_amount: yeniKalan,
      installment_remaining: yeniTaksitKalan,
      due_date: yeniDueDate || null,
      status: yeniKalan <= 0 ? 'paid' : 'active',
    }).eq('id', id)

    if (updateError) {
      setMessage('Hata: ' + updateError.message)
      setAddingPayment(false)
      return
    }

    if (taksitVarMi && eskiKalanTaksit !== null && yeniTaksitKalan !== null) {
      const tamamlanan = eskiKalanTaksit - yeniTaksitKalan
      if (tamamlanan > 0) {
        const notlar = [`${tamamlanan} taksit tamamlandı (kalan taksit: ${yeniTaksitKalan}).`]
        if (yeniDueDate !== dueDate) notlar.push(`Sıradaki ödeme tarihi ${new Date(yeniDueDate).toLocaleDateString('tr-TR')} olarak güncellendi.`)
        setInfoMessage(notlar.join(' '))
      } else if (turu === 'custom' && prepaymentStrategy === 'taksit_dussun') {
        setInfoMessage(`Ödeme kaydedildi. Vade aynı kaldı (${yeniTaksitKalan} taksit), kalan taksitlerin tutarı otomatik olarak yeniden hesaplandı.`)
      }
    }

    setPaymentAmount('')
    setSelectedInstallments(new Set())
    setAddingPayment(false)

    if (yeniKalan <= 0) {
      router.push('/dashboard/borclar')
      router.refresh()
    } else {
      fetchData()
    }
  }

  async function handleSelectedPay() {
    await odemeYap(secilenToplamTutar, 'plan', selectedInstallments.size)
  }

  async function handleCustomPay(e: React.FormEvent) {
    e.preventDefault()
    await odemeYap(parseFloat(paymentAmount), 'custom')
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const kesinKalan = alanlar.tekTutar ? totalAmount : remainingAmount

    const { error } = await supabase.from('debts').update({
      category,
      institution_name: institutionName,
      total_amount: parseFloat(totalAmount),
      remaining_amount: parseFloat(kesinKalan),
      installment_total: alanlar.taksit && installmentTotal ? parseInt(installmentTotal) : null,
      installment_remaining: alanlar.taksit && installmentRemaining ? parseInt(installmentRemaining) : null,
      interest_rate: alanlar.faiz && interestRate ? parseFloat(interestRate) : null,
      due_date: dueDate || null,
      prepayment_strategy: prepaymentStrategy,
      principal_amount: principalAmount ? parseFloat(principalAmount) : null,
    }).eq('id', id)

    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push('/dashboard/borclar')
      router.refresh()
    }
  }

  async function handleMarkPaid() {
    setSaving(true)
    const { error } = await supabase.from('debts').update({ status: 'paid', remaining_amount: 0 }).eq('id', id)
    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push('/dashboard/borclar')
      router.refresh()
    }
  }

  function handleDelete() {
    onayTetikle('Bu borcu silmek istediğine emin misin? Bu işlem geri alınamaz.', gercekBorcuSil)
  }

  async function gercekBorcuSil() {
    setOnayAcik(false)
    setSaving(true)
    const { error } = await supabase.from('debts').delete().eq('id', id)
    if (error) {
      setMessage('Hata: ' + error.message)
      setSaving(false)
    } else {
      router.push('/dashboard/borclar')
      router.refresh()
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/borclar')} className="text-paper/70 hover:text-paper text-sm">
          ← Panele dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-medium text-navy mb-1">{institutionName}</h1>
        <p className="text-sm text-muted mb-1">
          Kalan: <span className="font-mono text-navy">{parseFloat(remainingAmount).toLocaleString('tr-TR')} ₺</span>
          {alanlar.taksit && installmentRemaining && (
            <span> · {installmentRemaining}/{installmentTotal} taksit kaldı</span>
          )}
        </p>
        {taksitVarMi && parseInt(installmentRemaining || '0') > 0 ? (
          <p className="text-xs text-amber mb-6">
            Sıradaki taksit: <span className="font-mono">{siradakiTaksitTutari.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
            {kismiOdenenTutar > 0.5 && (
              <span> (bu taksitten {kismiOdenenTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ zaten ödendi)</span>
            )}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        {taksitVarMi && status !== 'paid' && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2">Ödeme Planı — ödemek istediğin taksit(ler)i seç</h2>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: parseInt(installmentTotal) }, (_, i) => i + 1).map((no) => {
                const odendi = no <= tamamlananTaksitSayisi
                const kismi = no === tamamlananTaksitSayisi + 1 && kismiOdenenTutar > 0.5
                const secili = selectedInstallments.has(no)
                const tarih = taksitTarihiHesapla(no)
                const renk = odendi
                  ? 'bg-sage-soft border-sage text-sage cursor-default'
                  : secili
                    ? 'bg-navy border-navy text-paper cursor-pointer'
                    : kismi
                      ? 'bg-amber-soft border-amber text-amber cursor-pointer hover:opacity-80'
                      : 'bg-white border-border text-muted cursor-pointer hover:opacity-80'
                return (
                  <button
                    type="button"
                    key={no}
                    onClick={() => toggleInstallmentSelection(no)}
                    disabled={odendi}
                    className={`w-[72px] h-[72px] rounded-lg border flex flex-col items-center justify-center text-xs transition-colors ${renk}`}
                  >
                    <span className="font-medium">{odendi ? '✓' : no}</span>
                    {!odendi && (
                      <span className="font-mono text-[10px] opacity-80">
                        {taksitTutariHesapla(no).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺
                      </span>
                    )}
                    {tarih && (
                      <span className="text-[9px] opacity-70 mt-0.5">
                        {new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-muted">
              <span><span className="inline-block w-2 h-2 rounded-full bg-sage mr-1" />Ödendi</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber mr-1" />Kısmi ödendi</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-border mr-1" />Bekliyor</span>
            </div>

            {selectedInstallments.size > 0 && (
              <button
                onClick={handleSelectedPay}
                disabled={addingPayment}
                className="mt-3 w-full bg-sage text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {addingPayment
                  ? 'Kaydediliyor...'
                  : `${selectedInstallments.size} taksiti öde — ${secilenToplamTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`}
              </button>
            )}
          </div>
        )}

        {status !== 'paid' && (
          <div className="bg-sage-soft rounded-lg p-4 mb-6">
            {!customMode ? (
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="text-sm font-medium text-sage underline"
              >
                Farklı bir tutar öde
              </button>
            ) : (
              <>
                <h2 className="text-sm font-medium text-sage mb-3">Farklı bir tutar öde</h2>
                <form onSubmit={handleCustomPay} className="flex flex-col gap-2">
                  <input
                    type="number" step="0.01" placeholder="Ödenen tutar (₺)"
                    value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit" disabled={addingPayment}
                      className="flex-1 bg-sage text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {addingPayment ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                    </button>
                    <button
                      type="button" onClick={() => { setCustomMode(false); setPaymentAmount('') }}
                      className="px-4 text-sm text-muted"
                    >
                      Vazgeç
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {payments.length > 0 && (
          <details className="mb-6">
            <summary className="text-sm font-medium text-muted cursor-pointer mb-2 flex items-center justify-between">
              <span>Ödeme Geçmişi ({payments.length})</span>
              {selectedPayments.size > 0 && (
                <button
                  onClick={(e) => { e.preventDefault(); handleDeleteSelectedPayments() }}
                  disabled={deletingPayments}
                  className="text-xs text-brick font-medium hover:underline disabled:opacity-60"
                >
                  {deletingPayments ? 'Siliniyor...' : `Seçilenleri Sil (${selectedPayments.size})`}
                </button>
              )}
            </summary>
            <p className="text-xs text-muted mb-2 mt-2">
              Yanlışlıkla eklenen bir kaydı işaretleyip silebilirsin. Silme, borcu bu ödeme hiç yapılmamış gibi eski haline getirir.
            </p>
            <div className="flex flex-col gap-1.5">
              {payments.map((p) => (
                <label
                  key={p.id}
                  className={`bg-white rounded-lg px-3 py-2 flex items-center gap-3 text-sm border cursor-pointer transition-colors ${
                    selectedPayments.has(p.id) ? 'border-brick bg-brick-soft/40' : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPayments.has(p.id)}
                    onChange={() => togglePaymentSelection(p.id)}
                  />
                  <span className="text-muted text-xs flex-1">
                    {new Date(p.paid_at).toLocaleDateString('tr-TR')}
                  </span>
                  <span className="font-mono text-navy">{Number(p.amount).toLocaleString('tr-TR')} ₺</span>
                </label>
              ))}
            </div>
          </details>
        )}

        {taksitVarMi && interestRate && parseFloat(interestRate) > 0 && parseInt(installmentRemaining || '0') > 0 && (() => {
          const girilenOran = parseFloat(interestRate)
          const rGirilen = girilenOran / 100
          const nOrijinal = parseInt(installmentTotal)
          const kalanTaksitSayisi = parseInt(installmentRemaining)
          const tamamlanan = tamamlananTaksitSayisi

          const anaparaGirildi = principalAmount && parseFloat(principalAmount) > 0

          if (anaparaGirildi) {
            // DOĞRU YÖNTEM: gerçek anapara verilmiş. Türkiye'deki tüketici kredisi standardı olan DÜZ FAİZ ile hesaplıyoruz.
            const P = parseFloat(principalAmount)
            const hesaplananOran = taksitTenFaizOraniHesapla(P, nOrijinal, orijinalTaksitTutari) * 100
            const oranFarkiVar = Math.abs(hesaplananOran - girilenOran) > 0.15

            // Düz faizde her taksitin anapara payı eşittir (P/n), bu yüzden kalan anapara doğrusal azalır.
            const kalanAnapara = P * (1 - tamamlanan / nOrijinal)

            const kalanTaksitlerToplami = orijinalTaksitTutari * kalanTaksitSayisi
            const kalanFaiz = Math.max(0, kalanTaksitlerToplami - kalanAnapara)

            return (
              <details className="mb-6 bg-amber-soft rounded-lg p-4 border border-amber/30">
                <summary className="text-sm font-medium text-navy cursor-pointer">Erken Kapama Analizi</summary>
                <p className="text-[11px] text-muted mb-3 mt-2">Anapara bilgine göre, düz faiz yöntemiyle (Türkiye'deki tüketici kredisi standardı) hesaplandı.</p>

                {oranFarkiVar && hesaplananOran > 0 && (
                  <div className="bg-white rounded-lg p-3 mb-3 text-xs">
                    <p className="text-muted mb-1">
                      Girdiğin faiz oranı: <span className="font-mono text-navy">%{girilenOran.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                      {' '}· Taksit tutarından hesaplanan gerçek oran: <span className="font-mono text-brick">%{hesaplananOran.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                    </p>
                    <p className="text-muted">
                      Fark, taksit tutarına KKDF/BSMV gibi vergilerin dahil edilmiş olmasından kaynaklanıyor olabilir. Aşağıda <b>taksit tutarından hesaplanan (gerçek) oranı</b> kullanıyoruz.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Şu an kalan anapara (tahmini)</span>
                    <span className="font-mono text-navy">{kalanAnapara.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Kalan {kalanTaksitSayisi} taksitte toplam ödeyeceğin</span>
                    <span className="font-mono text-navy">{kalanTaksitlerToplami.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">— bunun faiz payı</span>
                    <span className="font-mono text-brick">{kalanFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                  <div className="flex justify-between border-t border-amber/30 pt-2 mt-1">
                    <span className="text-muted">Şimdi kapatırsan ödeyeceğin (sadece anapara)</span>
                    <span className="font-mono text-navy">{kalanAnapara.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-sage">Erken kapatarak tasarrufun</span>
                    <span className="font-mono font-medium text-sage">{kalanFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                </div>
              </details>
            )
          }

          // Anapara girilmemişse: kaba bir tahmin yapıyoruz (kalan tutarı anapara sayarak), düz faiz yöntemiyle.
          const anaparaTahmini = parseFloat(remainingAmount)
          const toplamTahmini = anaparaTahmini * (1 + rGirilen * kalanTaksitSayisi)
          const faizTahmini = Math.max(0, toplamTahmini - anaparaTahmini)

          return (
            <details className="mb-6 bg-amber-soft rounded-lg p-4 border border-amber/30">
              <summary className="text-sm font-medium text-navy cursor-pointer">Erken Kapama Analizi (kaba tahmin)</summary>
              <p className="text-[11px] text-muted mb-3 mt-2">
                Daha kesin bir analiz için "Borç bilgilerini düzenle"den <b>Anapara</b> bilgisini gir. Şimdilik kalan tutar anapara kabul edilerek hesaplandı, bu gerçekte biraz farklı çıkabilir.
              </p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Kalan {kalanTaksitSayisi} taksitte toplam ödeyeceğin (tahmini)</span>
                  <span className="font-mono text-navy">{toplamTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">— bunun faiz payı (tahmini)</span>
                  <span className="font-mono text-brick">{faizTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                </div>
                <div className="flex justify-between border-t border-amber/30 pt-2 mt-1">
                  <span className="font-medium text-sage">Erken kapatarak olası tasarrufun</span>
                  <span className="font-mono font-medium text-sage">{faizTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                </div>
              </div>
            </details>
          )
        })()}

                <details className="mb-2">
          <summary className="text-sm font-medium text-muted cursor-pointer mb-3">Borç bilgilerini düzenle</summary>

          <form onSubmit={handleUpdate} className="flex flex-col gap-3 mt-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Borç Türü</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
                {KATEGORILER.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
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

            {alanlar.taksit && (
              <div>
                <label className="text-xs text-muted mb-1 block">Fazla / farklı tutar ödediğinde ne olsun?</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                    <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'vade_kisalsin'} onChange={() => setPrepaymentStrategy('vade_kisalsin')} />
                    <span><b className="text-navy">Vade kısalsın</b> — taksit tutarı sabit kalır, kalan taksit sayısı azalır (borç daha erken biter).</span>
                  </label>
                  <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                    <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'taksit_dussun'} onChange={() => setPrepaymentStrategy('taksit_dussun')} />
                    <span><b className="text-navy">Taksit tutarı düşsün</b> — taksit sayısı (vade) aynı kalır, kalan taksitlerin tutarı küçülür.</span>
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
                <p className="text-[11px] text-muted mt-1">
                  Bu, "Toplam Tutar"dan (taksitler toplamı, faiz dahil) daha küçük olmalı. Girersen "Erken Kapama Analizi" çok daha doğru hesaplanır.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-muted mb-1 block">
                {alanlar.taksit ? 'Sıradaki Taksit Tarihi' : 'Son Ödeme Tarihi'}
              </label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>

            <button type="submit" disabled={saving}
              className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>

            <button type="button" onClick={handleMarkPaid} disabled={saving}
              className="bg-sage-soft text-sage text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
              ✓ Tamamını Ödendi Olarak İşaretle
            </button>

            <button type="button" onClick={handleDelete} disabled={saving}
              className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
              Borcu Sil
            </button>
          </form>
        </details>

        {infoMessage && <p className="text-xs text-sage mt-2 bg-white rounded-lg px-3 py-2 border border-sage/30">{infoMessage}</p>}
        {message && <p className="text-xs text-brick mt-2">{message}</p>}
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
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from './OnayModal'
import Secim from './Secim'
import Modal from './Modal'
import Monogram from './Monogram'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import { amortismanSimuleEt } from '@/lib/finans-motoru'
import Skeleton from './Skeleton'
import { BORC_KATEGORILERI } from '@/lib/borc-kategorileri'

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; kmh: boolean; kurumEtiket: string }> = {
  kredi_karti: { taksit: false, faiz: true, kmh: false, kurumEtiket: 'Banka / Kart Adı' },
  kmh: { taksit: false, faiz: true, kmh: true, kurumEtiket: 'Banka Adı' },
  ihtiyac_kredisi: { taksit: true, faiz: true, kmh: false, kurumEtiket: 'Banka Adı' },
  konut_kredisi: { taksit: true, faiz: true, kmh: false, kurumEtiket: 'Banka Adı' },
  tasit_kredisi: { taksit: true, faiz: true, kmh: false, kurumEtiket: 'Banka Adı' },
  kisisel: { taksit: true, faiz: false, kmh: false, kurumEtiket: 'Kimden / Kime' },
  taksitli_alisveris: { taksit: true, faiz: false, kmh: false, kurumEtiket: 'Mağaza Adı' },
  diger: { taksit: true, faiz: true, kmh: false, kurumEtiket: 'Kurum / Kişi Adı' },
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
function taksitTenFaizOraniHesapla(P: number, n: number, M: number): number {
  if (n <= 0 || P <= 0 || M <= 0) return 0
  return Math.max(0, (M * n - P) / (P * n))
}

type Payment = { id: string; amount: number; paid_at: string }

// Kullanım: borç kartına bu bileşeni koy, debtId prop'u geçir, üstüne bir tetikleyici (children) sar.
export default function BorcDetayModal({ debtId, tetikleyici, onBasarili }: { debtId: string; tetikleyici: React.ReactNode; onBasarili?: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [aylikTaksitTutari, setAylikTaksitTutari] = useState('')
  const [kmhLimit, setKmhLimit] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('active')
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<'vade_kisalsin' | 'taksit_dussun'>('vade_kisalsin')

  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedInstallments, setSelectedInstallments] = useState<Set<number>>(new Set())
  const [customMode, setCustomMode] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [ekstraOdeme, setEkstraOdeme] = useState(0)

  const [onaySilBorcAcik, setOnaySilBorcAcik] = useState(false)
  const [onayTamamAcik, setOnayTamamAcik] = useState(false)
  const [onaySilOdemeAcik, setOnaySilOdemeAcik] = useState(false)
  const [onayOdemeAcik, setOnayOdemeAcik] = useState(false)
  const [bekleyenOdeme, setBekleyenOdeme] = useState<{ tutar: number; turu: 'plan' | 'custom'; adet?: number } | null>(null)
  const { goster } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: debt } = await supabase.from('debts').select('*').eq('id', debtId).single()
    if (debt) {
      setCategory(debt.category); setInstitutionName(debt.institution_name)
      setTotalAmount(String(debt.total_amount)); setRemainingAmount(String(debt.remaining_amount))
      setInstallmentTotal(debt.installment_total ? String(debt.installment_total) : '')
      setInstallmentRemaining(debt.installment_remaining ? String(debt.installment_remaining) : '')
      setInterestRate(debt.interest_rate ? String(debt.interest_rate) : '')
      setPrincipalAmount(debt.principal_amount ? String(debt.principal_amount) : '')
      setAylikTaksitTutari(debt.aylik_taksit_tutari ? String(debt.aylik_taksit_tutari) : '')
      setKmhLimit(debt.kmh_limit ? String(debt.kmh_limit) : '')
      setDueDate(debt.due_date || ''); setStatus(debt.status)
      setPrepaymentStrategy(debt.prepayment_strategy === 'taksit_dussun' ? 'taksit_dussun' : 'vade_kisalsin')
    }
    const { data: paymentList } = await supabase.from('payments').select('*').eq('debt_id', debtId).order('paid_at', { ascending: false })
    setPayments(paymentList || [])
    setSelectedPayments(new Set())
    setSelectedInstallments(new Set())
    setLoading(false)
  }, [debtId])

  useEffect(() => { if (acik) fetchData() }, [acik, fetchData])

  const alanlar = KATEGORI_ALANLAR[category] || { taksit: false, faiz: false, kmh: false, kurumEtiket: 'Kurum / Kişi Adı' }
  const orijinalTaksitTutari = installmentTotal && totalAmount ? parseFloat(totalAmount) / parseInt(installmentTotal) : 0
  const taksitVarMi = alanlar.taksit && !!installmentTotal && orijinalTaksitTutari > 0
  const tamamlananTaksitSayisi = taksitVarMi ? (parseInt(installmentTotal) - parseInt(installmentRemaining || '0')) : 0
  const taksitTutari = (() => {
    if (!taksitVarMi) return 0
    if (prepaymentStrategy === 'taksit_dussun') {
      const kalanTaksit = parseInt(installmentRemaining || '0')
      return kalanTaksit > 0 ? parseFloat(remainingAmount || '0') / kalanTaksit : 0
    }
    return orijinalTaksitTutari
  })()
  const secilenToplamTutar = Array.from(selectedInstallments).reduce((s) => s + taksitTutari, 0)

  function toggleInstallmentSelection(no: number) {
    if (no <= tamamlananTaksitSayisi) return
    setSelectedInstallments((prev) => {
      const next = new Set(prev)
      if (next.has(no)) next.delete(no); else next.add(no)
      return next
    })
  }

  async function odemeYap(odenenTutar: number, turu: 'plan' | 'custom', taksitAdedi?: number) {
    setProcessing(true); setMessage(''); setInfoMessage('')
    if (!odenenTutar || odenenTutar <= 0) { setMessage('Geçerli bir ödeme tutarı gir.'); setProcessing(false); return }

    const eskiKalanTaksit = installmentRemaining ? parseInt(installmentRemaining) : null
    const yeniKalan = Math.max(0, parseFloat(remainingAmount) - odenenTutar)
    let yeniTaksitKalan: number | null = eskiKalanTaksit

    if (taksitVarMi && eskiKalanTaksit !== null) {
      if (turu === 'plan') yeniTaksitKalan = Math.max(0, eskiKalanTaksit - (taksitAdedi || 0))
      else if (prepaymentStrategy === 'vade_kisalsin') yeniTaksitKalan = yeniKalan <= 0 ? 0 : Math.min(parseInt(installmentTotal), Math.ceil(yeniKalan / orijinalTaksitTutari))
      else yeniTaksitKalan = eskiKalanTaksit
    }

    let yeniDueDate = dueDate
    if (taksitVarMi && eskiKalanTaksit !== null && yeniTaksitKalan !== null) {
      const tamamlanan = eskiKalanTaksit - yeniTaksitKalan
      if (tamamlanan > 0 && dueDate) yeniDueDate = tarihiAyKaydir(dueDate, tamamlanan)
    }

    const { error } = await supabase.rpc('odeme_kaydet', {
      p_debt_id: debtId, p_amount: odenenTutar, p_yeni_kalan_tutar: yeniKalan, p_yeni_taksit_kalan: yeniTaksitKalan,
      p_yeni_due_date: yeniDueDate || null, p_yeni_status: yeniKalan <= 0 ? 'paid' : 'active',
    })

    if (error) { setMessage(hataMesajiCevir(error)); setProcessing(false); return }
    setProcessing(false)
    setPaymentAmount(''); setCustomMode(false)
    fetchData()
    goster(`${odenenTutar.toLocaleString('tr-TR')} ₺ ödeme kaydedildi.`)
    ;(onBasarili ? onBasarili() : router.refresh())
  }

  function handleSelectedPay() {
    if (selectedInstallments.size === 0) return
    setBekleyenOdeme({ tutar: secilenToplamTutar, turu: 'plan', adet: selectedInstallments.size })
    setOnayOdemeAcik(true)
  }

  function handleCustomPay(e: React.FormEvent) {
    e.preventDefault()
    const tutar = parseFloat(paymentAmount)
    if (!tutar || tutar <= 0) { setMessage('Geçerli bir tutar gir.'); return }
    setBekleyenOdeme({ tutar, turu: 'custom' })
    setOnayOdemeAcik(true)
  }

  async function gercekOdemeyiYap() {
    if (!bekleyenOdeme) return
    setOnayOdemeAcik(false)
    await odemeYap(bekleyenOdeme.tutar, bekleyenOdeme.turu, bekleyenOdeme.adet)
    setBekleyenOdeme(null)
  }

  async function gercekTamaminiOde() {
    setOnayTamamAcik(false); setProcessing(true)
    // ÖNEMLİ: doğrudan debts.update() yapmıyoruz — bu, payments tablosuna hiç kayıt bırakmadığı için
    // "Son 6 Ay Ödeme Trendi", streak ve diğer geçmişe dayalı hesaplamaların bu ödemeyi hiç görmemesine
    // yol açıyordu. Normal taksit ödemeleriyle AYNI atomik RPC'yi kullanıyoruz.
    const kalanTutar = parseFloat(remainingAmount)
    const { error } = await supabase.rpc('odeme_kaydet', {
      p_debt_id: debtId,
      p_amount: kalanTutar,
      p_yeni_kalan_tutar: 0,
      p_yeni_taksit_kalan: taksitVarMi ? 0 : null,
      p_yeni_due_date: null,
      p_yeni_status: 'paid',
    })
    setProcessing(false)
    if (error) setMessage(hataMesajiCevir(error))
    else { goster('Borç ödendi olarak işaretlendi.'); setAcik(false); (onBasarili ? onBasarili() : router.refresh()) }
  }

  function toggleTogglePaymentSelection(paymentId: string) {
    setSelectedPayments((prev) => {
      const next = new Set(prev)
      if (next.has(paymentId)) next.delete(paymentId); else next.add(paymentId)
      return next
    })
  }

  async function gercekOdemeleriSil() {
    setOnaySilOdemeAcik(false); setProcessing(true); setMessage('')
    const silinecekler = payments.filter((p) => selectedPayments.has(p.id))
    const toplamGeriEklenecekTutar = silinecekler.reduce((sum, p) => sum + Number(p.amount), 0)
    const toplamTutar = parseFloat(totalAmount)
    const yeniKalanTutar = Math.min(toplamTutar || Infinity, parseFloat(remainingAmount) + toplamGeriEklenecekTutar)

    const eskiKalanTaksitSil = installmentRemaining ? parseInt(installmentRemaining) : null
    let yeniKalanTaksit = eskiKalanTaksitSil
    if (taksitVarMi && prepaymentStrategy === 'vade_kisalsin') {
      yeniKalanTaksit = yeniKalanTutar <= 0 ? 0 : Math.min(parseInt(installmentTotal), Math.ceil(yeniKalanTutar / orijinalTaksitTutari))
    }
    let yeniDueDateSil = dueDate
    if (taksitVarMi && prepaymentStrategy === 'vade_kisalsin' && eskiKalanTaksitSil !== null && yeniKalanTaksit !== null) {
      const fark = yeniKalanTaksit - eskiKalanTaksitSil
      if (fark > 0 && dueDate) yeniDueDateSil = tarihiAyKaydir(dueDate, -fark)
    }

    const { error } = await supabase.rpc('odeme_sil_ve_geri_al', {
      p_payment_ids: Array.from(selectedPayments), p_debt_id: debtId, p_yeni_kalan_tutar: yeniKalanTutar,
      p_yeni_taksit_kalan: yeniKalanTaksit, p_yeni_due_date: yeniDueDateSil || null, p_yeni_status: yeniKalanTutar > 0 ? 'active' : 'paid',
    })
    setProcessing(false)
    if (error) { setMessage(hataMesajiCevir(error)); return }
    fetchData()
    goster('Seçilen ödemeler geri alındı.')
    ;(onBasarili ? onBasarili() : router.refresh())
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage('')
    // KMH'de "Toplam Tutar" kavramı yok — güncel bakiyeyle aynı kabul ediyoruz (limit ayrı saklanıyor)
    const kesinToplamTutar = alanlar.kmh ? parseFloat(remainingAmount) : parseFloat(totalAmount)
    const { error } = await supabase.from('debts').update({
      category, institution_name: institutionName, total_amount: kesinToplamTutar, remaining_amount: parseFloat(remainingAmount),
      installment_total: alanlar.taksit && installmentTotal ? parseInt(installmentTotal) : null,
      installment_remaining: alanlar.taksit && installmentRemaining ? parseInt(installmentRemaining) : null,
      interest_rate: alanlar.faiz && interestRate ? parseFloat(interestRate) : null,
      principal_amount: principalAmount ? parseFloat(principalAmount) : null,
      aylik_taksit_tutari: aylikTaksitTutari ? parseFloat(aylikTaksitTutari) : null,
      kmh_limit: alanlar.kmh && kmhLimit ? parseFloat(kmhLimit) : null,
      due_date: dueDate || null, prepayment_strategy: prepaymentStrategy,
    }).eq('id', debtId)
    if (error) { setMessage(hataMesajiCevir(error)); setSaving(false) }
    else { setSaving(false); fetchData(); goster('Değişiklikler kaydedildi.'); (onBasarili ? onBasarili() : router.refresh()) }
  }

  async function gercekBorcuSil() {
    setOnaySilBorcAcik(false); setSaving(true)
    const { error } = await supabase.from('debts').delete().eq('id', debtId)
    if (error) { setMessage(hataMesajiCevir(error)); setSaving(false) }
    else { setSaving(false); setAcik(false); goster('Borç silindi.'); (onBasarili ? onBasarili() : router.refresh()) }
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik={institutionName || 'Borç Detayı'} onKapat={() => setAcik(false)}>
        {loading ? (
          <Skeleton satirlar={3} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <Monogram isim={institutionName} boyut={40} />
              <div>
                <p className="text-sm text-navy font-medium">Kalan: <span className="font-mono">{parseFloat(remainingAmount).toLocaleString('tr-TR')} ₺</span></p>
                {status === 'paid' && <span className="text-xs text-sage">✓ Kapandı</span>}
              </div>
            </div>

            {status !== 'paid' && taksitVarMi && (
              <div className="mb-5">
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Ödeme Planı</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: parseInt(installmentTotal) }, (_, i) => i + 1).map((no) => {
                    const odendi = no <= tamamlananTaksitSayisi
                    const secili = selectedInstallments.has(no)
                    const renk = odendi ? 'bg-sage-soft border-sage text-sage cursor-default'
                      : secili ? 'bg-navy border-navy text-paper cursor-pointer' : 'bg-white border-border text-muted cursor-pointer hover:opacity-80'
                    return (
                      <button type="button" key={no} onClick={() => toggleInstallmentSelection(no)} disabled={odendi}
                        className={`w-[60px] h-[60px] rounded-lg border flex flex-col items-center justify-center text-xs transition-colors ${renk}`}>
                        <span className="font-medium">{odendi ? '✓' : no}</span>
                        {!odendi && <span className="font-mono text-[9px] opacity-80">{taksitTutari.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺</span>}
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

            {status !== 'paid' && (
              <div className="bg-sage-soft rounded-lg p-4 mb-4">
                {!customMode ? (
                  <button type="button" onClick={() => setCustomMode(true)} className="text-sm font-medium text-sage underline">Farklı bir tutar öde</button>
                ) : (
                  <>
                    <h3 className="text-sm font-medium text-sage mb-3">Farklı bir tutar öde</h3>
                    <form onSubmit={handleCustomPay} className="flex flex-col gap-2">
                      <input type="number" step="0.01" placeholder="Ödenen tutar (₺)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
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
            )}

            {status !== 'paid' && (
              <button onClick={() => setOnayTamamAcik(true)} disabled={processing}
                className="w-full bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 mb-4 hover:bg-paper transition-colors">
                ✓ Tamamını Ödendi Olarak İşaretle
              </button>
            )}

            {payments.length > 0 && (
              <details className="mb-4">
                <summary className="text-sm font-medium text-muted cursor-pointer flex items-center justify-between">
                  <span>Ödeme Geçmişi ({payments.length})</span>
                  {selectedPayments.size > 0 && (
                    <button onClick={(e) => { e.preventDefault(); setOnaySilOdemeAcik(true) }} disabled={processing}
                      className="text-xs text-brick font-medium hover:underline disabled:opacity-60">
                      Seçilenleri Sil ({selectedPayments.size})
                    </button>
                  )}
                </summary>
                <div className="flex flex-col gap-1.5 mt-2">
                  {payments.map((p) => (
                    <label key={p.id} className={`bg-white rounded-lg px-3 py-2 flex items-center gap-3 text-sm border cursor-pointer transition-colors ${selectedPayments.has(p.id) ? 'border-brick bg-brick-soft/40' : 'border-border'}`}>
                      <input type="checkbox" checked={selectedPayments.has(p.id)} onChange={() => toggleTogglePaymentSelection(p.id)} />
                      <span className="text-muted text-xs flex-1">{new Date(p.paid_at).toLocaleDateString('tr-TR')}</span>
                      <span className="font-mono text-navy">{Number(p.amount).toLocaleString('tr-TR')} ₺</span>
                    </label>
                  ))}
                </div>
              </details>
            )}

            {taksitVarMi && interestRate && parseFloat(interestRate) > 0 && parseInt(installmentRemaining || '0') > 0 && principalAmount && parseFloat(principalAmount) > 0 && (() => {
              const P = parseFloat(principalAmount)
              const nOrijinal = parseInt(installmentTotal)
              const kalanTaksitSayisi = parseInt(installmentRemaining)
              const tamamlanan = tamamlananTaksitSayisi
              const kalanAnaparaBasit = P * (1 - tamamlanan / nOrijinal) // aylikTaksitTutari yoksa yaklaşık kalan anapara

              // FİNANS MOTORU: aylik_taksit_tutari girilmişse GERÇEK amortisman (bankayla eşleşen),
              // girilmemişse (eski kayıtlar) eskisi gibi yaklaşık hesap — çalışan özelliği bozmuyoruz.
              const gercekVeriVar = !!aylikTaksitTutari && parseFloat(aylikTaksitTutari) > 0
              const aylikFaizOrani = parseFloat(interestRate) / 100

              let kalanAnapara: number
              let kalanFaiz: number
              let anaparaPayi: number
              let simKazanilanAy: number
              let simTasarrufFaiz: number
              let taksitTutariGosterim: number

              if (gercekVeriVar) {
                const taksitTutari = parseFloat(aylikTaksitTutari)
                taksitTutariGosterim = taksitTutari
                kalanAnapara = kalanAnaparaBasit
                const normal = amortismanSimuleEt({ kalanAnapara, aylikFaizOrani, aylikTaksitTutari: taksitTutari })
                kalanFaiz = normal.gecersiz ? 0 : normal.kalanFaizToplami
                anaparaPayi = taksitTutari - kalanAnapara * aylikFaizOrani // ilk ayki yaklaşık anapara payı (slider max için)

                const ekstrali = amortismanSimuleEt({ kalanAnapara, aylikFaizOrani, aylikTaksitTutari: taksitTutari, ekstraOdeme: ekstraOdeme })
                if (!normal.gecersiz && !ekstrali.gecersiz) {
                  simKazanilanAy = Math.max(0, normal.aySayisi - ekstrali.aySayisi)
                  simTasarrufFaiz = Math.max(0, normal.kalanFaizToplami - ekstrali.kalanFaizToplami)
                } else {
                  simKazanilanAy = 0; simTasarrufFaiz = 0
                }
              } else {
                // Eski (yaklaşık) yöntem — aylik_taksit_tutari henüz girilmemiş borçlar için
                kalanAnapara = kalanAnaparaBasit
                const kalanTaksitlerToplami = orijinalTaksitTutari * kalanTaksitSayisi
                kalanFaiz = Math.max(0, kalanTaksitlerToplami - kalanAnapara)
                anaparaPayi = P / nOrijinal
                taksitTutariGosterim = orijinalTaksitTutari
                const simYeniAySayisi = Math.ceil(kalanAnapara / (anaparaPayi + ekstraOdeme))
                simKazanilanAy = Math.max(0, kalanTaksitSayisi - Math.min(simYeniAySayisi, kalanTaksitSayisi))
                simTasarrufFaiz = simKazanilanAy * (orijinalTaksitTutari - anaparaPayi)
              }

              return (
                <details className="mb-4 bg-amber-soft rounded-lg p-4 border border-amber/30">
                  <summary className="text-sm font-medium text-navy cursor-pointer">Erken Kapama Analizi</summary>
                  {!gercekVeriVar && (
                    <p className="text-[11px] text-muted mt-2">
                      Bu, yaklaşık bir hesap. "Aylık Taksit Tutarı"nı düzenle bölümünden girersen banka hesabınla birebir eşleşen kesin rakamları görürsün.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 text-sm mt-3">
                    <div className="flex justify-between"><span className="text-muted">Kalan anapara</span><span className="font-mono text-navy">{kalanAnapara.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                    <div className="flex justify-between"><span className="font-medium text-sage">Erken kapatarak tasarrufun</span><span className="font-mono font-medium text-sage">{kalanFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-amber/30">
                    <p className="text-xs font-medium text-navy mb-2">Ya her ay biraz fazla ödersem?</p>
                    <input type="range" min={0} max={Math.round(taksitTutariGosterim)} step={50} value={ekstraOdeme}
                      onChange={(e) => setEkstraOdeme(Number(e.target.value))} className="w-full accent-sage" />
                    <p className="text-xs text-muted mb-3">Her ay <span className="font-mono text-navy">+{ekstraOdeme.toLocaleString('tr-TR')} ₺</span> fazladan ödersen:</p>
                    <div className="bg-white rounded-lg p-3 flex flex-col gap-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Kaç ay erken biter</span><span className="font-mono text-sage font-medium">{simKazanilanAy} ay</span></div>
                      <div className="flex justify-between"><span className="text-muted">Ek faiz tasarrufu</span><span className="font-mono text-sage font-medium">{simTasarrufFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
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
                  <Secim value={category} onChange={(e) => setCategory(e.target.value)}>
                    {BORC_KATEGORILERI.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </Secim>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">{alanlar.kurumEtiket}</label>
                  <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
                </div>
                {alanlar.kmh ? (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted mb-1 block">Limit (₺)</label>
                      <input type="number" step="0.01" value={kmhLimit} onChange={(e) => setKmhLimit(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted mb-1 block">Güncel Kullanılan Bakiye (₺)</label>
                      <input type="number" step="0.01" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} required
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                    </div>
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
                {alanlar.taksit && alanlar.faiz && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">
                      Aylık Taksit Tutarı (₺) — girersen Erken Kapama Analizi gerçek banka hesabıyla eşleşir
                    </label>
                    <input type="number" step="0.01" value={aylikTaksitTutari} onChange={(e) => setAylikTaksitTutari(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                  </div>
                )}
                {alanlar.taksit && (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                      <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'vade_kisalsin'} onChange={() => setPrepaymentStrategy('vade_kisalsin')} />
                      <span><b className="text-navy">Vade kısalsın</b> — taksit tutarı sabit, taksit sayısı azalır.</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs bg-white border border-border rounded-lg p-3 cursor-pointer">
                      <input type="radio" className="mt-0.5" checked={prepaymentStrategy === 'taksit_dussun'} onChange={() => setPrepaymentStrategy('taksit_dussun')} />
                      <span><b className="text-navy">Taksit tutarı düşsün</b> — taksit sayısı sabit, tutar küçülür.</span>
                    </label>
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
                    <label className="text-xs text-muted mb-1 block">Anapara — opsiyonel</label>
                    <input type="number" step="0.01" value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
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
                <button type="button" onClick={() => setOnaySilBorcAcik(true)} disabled={saving}
                  className="bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
                  Borcu Sil
                </button>
              </form>
            </details>

            {message && <p className="text-xs text-brick mt-2">{message}</p>}
            {infoMessage && <p className="text-xs text-sage mt-2">{infoMessage}</p>}
          </>
        )}
      </Modal>

      <OnayModal acik={onaySilBorcAcik} baslik="Emin misin?" mesaj="Bu borcu silmek istediğine emin misin?" onOnayla={gercekBorcuSil} onVazgec={() => setOnaySilBorcAcik(false)} />
      <OnayModal acik={onayTamamAcik} baslik="Emin misin?" mesaj="Bu borcu tamamen ödendi olarak işaretlemek istediğine emin misin?" onayMetni="Evet, Ödendi" tehlikeli={false} onOnayla={gercekTamaminiOde} onVazgec={() => setOnayTamamAcik(false)} />
      <OnayModal acik={onaySilOdemeAcik} baslik="Emin misin?" mesaj={`${selectedPayments.size} ödeme kaydını silmek istediğine emin misin?`} onOnayla={gercekOdemeleriSil} onVazgec={() => setOnaySilOdemeAcik(false)} />
      <OnayModal
        acik={onayOdemeAcik}
        baslik="Ödemeyi onayla"
        mesaj={bekleyenOdeme ? `${bekleyenOdeme.tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ ödeme kaydetmek istediğine emin misin?` : ''}
        onayMetni="Evet, Öde"
        tehlikeli={false}
        onOnayla={gercekOdemeyiYap}
        onVazgec={() => { setOnayOdemeAcik(false); setBekleyenOdeme(null) }}
      />
    </>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'

const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; tekTutar: boolean }> = {
  kredi_karti: { taksit: false, faiz: true, tekTutar: false },
  ihtiyac_kredisi: { taksit: true, faiz: true, tekTutar: false },
  konut_kredisi: { taksit: true, faiz: true, tekTutar: false },
  tasit_kredisi: { taksit: true, faiz: true, tekTutar: false },
  kisisel: { taksit: true, faiz: false, tekTutar: false },
  taksitli_alisveris: { taksit: true, faiz: false, tekTutar: false },
  diger: { taksit: true, faiz: true, tekTutar: false },
}

const KATEGORI_ETIKET: Record<string, string> = {
  kredi_karti: 'Kredi Kartı', ihtiyac_kredisi: 'İhtiyaç Kredisi', konut_kredisi: 'Konut Kredisi',
  tasit_kredisi: 'Taşıt Kredisi', kisisel: 'Kişisel Borç', taksitli_alisveris: 'Taksitli Alışveriş', diger: 'Diğer',
}

function ikiBasamak(n: number) {
  return String(n).padStart(2, '0')
}

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
  const oran = (M * n - P) / (P * n)
  return Math.max(0, oran)
}

type Payment = { id: string; amount: number; paid_at: string }

export default function BorcDetayPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [ekstraOdeme, setEkstraOdeme] = useState(0)

  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [installmentTotal, setInstallmentTotal] = useState('')
  const [installmentRemaining, setInstallmentRemaining] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('active')
  const [prepaymentStrategy, setPrepaymentStrategy] = useState<'vade_kisalsin' | 'taksit_dussun'>('vade_kisalsin')
  const [principalAmount, setPrincipalAmount] = useState('')

  const [payments, setPayments] = useState<Payment[]>([])

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
      setDueDate(debt.due_date || '')
      setStatus(debt.status)
      setPrepaymentStrategy(debt.prepayment_strategy === 'taksit_dussun' ? 'taksit_dussun' : 'vade_kisalsin')
      setPrincipalAmount(debt.principal_amount ? String(debt.principal_amount) : '')
    }

    const { data: paymentList } = await supabase
      .from('payments').select('*').eq('debt_id', id).order('paid_at', { ascending: false })
    setPayments(paymentList || [])

    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  const alanlar = KATEGORI_ALANLAR[category] || { taksit: false, faiz: false, tekTutar: true }
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

  const toplamOdenen = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, parseFloat(totalAmount || '0') - parseFloat(remainingAmount || '0')) : 0
  const kismiOdenenTutar = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, toplamOdenen - tamamlananTaksitSayisi * orijinalTaksitTutari) : 0
  const kismiKalanTutar = (taksitVarMi && prepaymentStrategy === 'vade_kisalsin')
    ? Math.max(0, orijinalTaksitTutari - kismiOdenenTutar) : 0
  const siradakiTaksitTutari = kismiOdenenTutar > 0.5 ? kismiKalanTutar : taksitTutari

  function taksitTutariHesapla(no: number) {
    if (prepaymentStrategy === 'vade_kisalsin' && no === tamamlananTaksitSayisi + 1 && kismiOdenenTutar > 0.5) return kismiKalanTutar
    return taksitTutari
  }
  function taksitTarihiHesapla(no: number): string | null {
    if (!dueDate) return null
    const offset = no - (tamamlananTaksitSayisi + 1)
    return tarihiAyKaydir(dueDate, offset)
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/borclar')} className="text-paper/70 hover:text-paper text-sm">
          ← Panele dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Monogram isim={institutionName} boyut={44} />
          <h1 className="text-xl font-medium text-navy">{institutionName}</h1>
        </div>
        <p className="text-xs text-muted mb-1">{KATEGORI_ETIKET[category] || category}{status === 'paid' && <span className="ml-1.5 text-sage">· Kapandı</span>}</p>
        <p className="text-sm text-muted mb-1">
          Kalan: <span className="font-mono text-navy">{parseFloat(remainingAmount).toLocaleString('tr-TR')} ₺</span>
          {alanlar.taksit && installmentRemaining && (
            <span> · {installmentRemaining}/{installmentTotal} taksit kaldı</span>
          )}
        </p>
        {taksitVarMi && parseInt(installmentRemaining || '0') > 0 && status !== 'paid' ? (
          <p className="text-xs text-amber mb-4">
            Sıradaki taksit: <span className="font-mono">{siradakiTaksitTutari.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
            {kismiOdenenTutar > 0.5 && (
              <span> (bu taksitten {kismiOdenenTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ zaten ödendi)</span>
            )}
          </p>
        ) : <div className="mb-4" />}

        {status !== 'paid' && (
          <div className="flex gap-2 mb-6">
            <Link href={`/dashboard/borc/${id}/ode`} className="flex-1 bg-sage text-white text-sm font-medium rounded-lg py-2.5 text-center hover:opacity-90 transition-opacity">
              💳 Ödeme Yap
            </Link>
            <Link href={`/dashboard/borc/${id}/duzenle`} className="flex-1 bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 text-center hover:bg-paper transition-colors">
              ✎ Düzenle
            </Link>
          </div>
        )}
        {status === 'paid' && (
          <div className="mb-6">
            <Link href={`/dashboard/borc/${id}/duzenle`} className="inline-block bg-white border border-border text-navy text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-paper transition-colors">
              ✎ Düzenle
            </Link>
          </div>
        )}

        {taksitVarMi && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-2">Ödeme Planı</h2>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: parseInt(installmentTotal) }, (_, i) => i + 1).map((no) => {
                const odendi = no <= tamamlananTaksitSayisi
                const kismi = no === tamamlananTaksitSayisi + 1 && kismiOdenenTutar > 0.5
                const tarih = taksitTarihiHesapla(no)
                const renk = odendi ? 'bg-sage-soft border-sage text-sage' : kismi ? 'bg-amber-soft border-amber text-amber' : 'bg-white border-border text-muted'
                return (
                  <div key={no} className={`w-[72px] h-[72px] rounded-lg border flex flex-col items-center justify-center text-xs ${renk}`}>
                    <span className="font-medium">{odendi ? '✓' : no}</span>
                    {!odendi && <span className="font-mono text-[10px] opacity-80">{taksitTutariHesapla(no).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺</span>}
                    {tarih && <span className="text-[9px] opacity-70 mt-0.5">{new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-muted">
              <span><span className="inline-block w-2 h-2 rounded-full bg-sage mr-1" />Ödendi</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber mr-1" />Kısmi ödendi</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-border mr-1" />Bekliyor</span>
            </div>
          </div>
        )}

        {payments.length > 0 && (
          <details className="mb-6">
            <summary className="text-sm font-medium text-muted cursor-pointer">Ödeme Geçmişi ({payments.length})</summary>
            <div className="flex flex-col gap-1.5 mt-2">
              {payments.map((p) => (
                <div key={p.id} className="bg-white rounded-lg px-3 py-2 flex justify-between items-center text-sm border border-border">
                  <span className="text-muted text-xs">{new Date(p.paid_at).toLocaleDateString('tr-TR')}</span>
                  <span className="font-mono text-navy">{Number(p.amount).toLocaleString('tr-TR')} ₺</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2">Yanlış girilmiş bir ödemeyi düzeltmek için "Düzenle" sayfasına gidebilirsin.</p>
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
            const P = parseFloat(principalAmount)
            const hesaplananOran = taksitTenFaizOraniHesapla(P, nOrijinal, orijinalTaksitTutari) * 100
            const oranFarkiVar = Math.abs(hesaplananOran - girilenOran) > 0.15
            const kalanAnapara = P * (1 - tamamlanan / nOrijinal)
            const kalanTaksitlerToplami = orijinalTaksitTutari * kalanTaksitSayisi
            const kalanFaiz = Math.max(0, kalanTaksitlerToplami - kalanAnapara)

            // Simülasyon: her ay ekstra X TL daha ödersen ne olur (düz faiz varsayımıyla basitleştirilmiş)
            const anaparaPayi = P / nOrijinal // her taksitin sabit anapara payı
            const etkinAylikOdeme = orijinalTaksitTutari + ekstraOdeme
            const simYeniAySayisi = etkinAylikOdeme > 0 ? Math.ceil(kalanAnapara / (anaparaPayi + ekstraOdeme)) : kalanTaksitSayisi
            const simKazanilanAy = Math.max(0, kalanTaksitSayisi - Math.min(simYeniAySayisi, kalanTaksitSayisi))
            const simTasarrufFaiz = simKazanilanAy * (orijinalTaksitTutari - anaparaPayi)

            return (
              <details className="mb-6 bg-amber-soft rounded-lg p-4 border border-amber/30">
                <summary className="text-sm font-medium text-navy cursor-pointer">Erken Kapama Analizi</summary>
                <p className="text-[11px] text-muted mb-3 mt-2">Anapara bilgine göre, düz faiz yöntemiyle hesaplandı.</p>
                {oranFarkiVar && hesaplananOran > 0 && (
                  <div className="bg-white rounded-lg p-3 mb-3 text-xs">
                    <p className="text-muted mb-1">
                      Girdiğin faiz oranı: <span className="font-mono text-navy">%{girilenOran.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                      {' '}· Taksit tutarından hesaplanan gerçek oran: <span className="font-mono text-brick">%{hesaplananOran.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                    </p>
                    <p className="text-muted">Fark, KKDF/BSMV gibi vergilerden kaynaklanıyor olabilir.</p>
                  </div>
                )}
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Şu an kalan anapara (tahmini)</span><span className="font-mono text-navy">{kalanAnapara.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  <div className="flex justify-between"><span className="text-muted">Kalan {kalanTaksitSayisi} taksitte toplam</span><span className="font-mono text-navy">{kalanTaksitlerToplami.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  <div className="flex justify-between"><span className="text-muted">— bunun faiz payı</span><span className="font-mono text-brick">{kalanFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  <div className="flex justify-between border-t border-amber/30 pt-2 mt-1"><span className="text-muted">Şimdi kapatırsan ödeyeceğin</span><span className="font-mono text-navy">{kalanAnapara.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  <div className="flex justify-between"><span className="font-medium text-sage">Erken kapatarak tasarrufun</span><span className="font-mono font-medium text-sage">{kalanFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                </div>

                <div className="mt-4 pt-4 border-t border-amber/30">
                  <p className="text-xs font-medium text-navy mb-2">Ya her ay biraz fazla ödersem?</p>
                  <input
                    type="range" min={0} max={Math.round(orijinalTaksitTutari)} step={50}
                    value={ekstraOdeme}
                    onChange={(e) => setEkstraOdeme(Number(e.target.value))}
                    className="w-full accent-sage"
                  />
                  <p className="text-xs text-muted mb-3">
                    Her ay <span className="font-mono text-navy">+{ekstraOdeme.toLocaleString('tr-TR')} ₺</span> fazladan ödersen:
                  </p>
                  <div className="bg-white rounded-lg p-3 flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted">Kaç ay erken biter</span><span className="font-mono text-sage font-medium">{simKazanilanAy} ay</span></div>
                    <div className="flex justify-between"><span className="text-muted">Ek faiz tasarrufu</span><span className="font-mono text-sage font-medium">{simTasarrufFaiz.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                  </div>
                </div>
              </details>
            )
          }

          const anaparaTahmini = parseFloat(remainingAmount)
          const toplamTahmini = anaparaTahmini * (1 + rGirilen * kalanTaksitSayisi)
          const faizTahmini = Math.max(0, toplamTahmini - anaparaTahmini)

          return (
            <details className="mb-6 bg-amber-soft rounded-lg p-4 border border-amber/30">
              <summary className="text-sm font-medium text-navy cursor-pointer">Erken Kapama Analizi (kaba tahmin)</summary>
              <p className="text-[11px] text-muted mb-3 mt-2">Daha kesin analiz için "Düzenle"den Anapara bilgisini gir.</p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Kalan {kalanTaksitSayisi} taksitte toplam (tahmini)</span><span className="font-mono text-navy">{toplamTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                <div className="flex justify-between"><span className="text-muted">— bunun faiz payı (tahmini)</span><span className="font-mono text-brick">{faizTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                <div className="flex justify-between border-t border-amber/30 pt-2 mt-1"><span className="font-medium text-sage">Erken kapatarak olası tasarrufun</span><span className="font-mono font-medium text-sage">{faizTahmini.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
              </div>
            </details>
          )
        })()}
      </main>
    </div>
  )
}
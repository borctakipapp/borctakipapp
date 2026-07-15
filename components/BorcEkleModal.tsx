'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Secim from './Secim'
import Modal from './Modal'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import { useToast } from './Toast'
import { BORC_KATEGORILERI } from '@/lib/borc-kategorileri'
import { faizOraniTahminEt } from '@/lib/finans-motoru'

// FAZ B: taksitli kredilerde artık "Toplam Tutar/Toplam Taksit" gibi kullanıcının kendi
// hesaplaması gereken alanlar YOK. Sadece bankada/ekstrede yazan, doğrudan okunabilecek
// bilgiler isteniyor — sistem geri kalanını türetiyor.
const KATEGORI_ALANLAR: Record<string, { taksit: boolean; faiz: boolean; tekTutar: boolean; kmh: boolean; kurumEtiket: string }> = {
  kredi_karti: { taksit: false, faiz: true, tekTutar: false, kmh: false, kurumEtiket: 'Banka / Kart Adı' },
  kmh: { taksit: false, faiz: true, tekTutar: false, kmh: true, kurumEtiket: 'Banka Adı' },
  ihtiyac_kredisi: { taksit: true, faiz: true, tekTutar: false, kmh: false, kurumEtiket: 'Banka Adı' },
  konut_kredisi: { taksit: true, faiz: true, tekTutar: false, kmh: false, kurumEtiket: 'Banka Adı' },
  tasit_kredisi: { taksit: true, faiz: true, tekTutar: false, kmh: false, kurumEtiket: 'Banka Adı' },
  kisisel: { taksit: true, faiz: false, tekTutar: false, kmh: false, kurumEtiket: 'Kimden / Kime' },
  taksitli_alisveris: { taksit: true, faiz: false, tekTutar: false, kmh: false, kurumEtiket: 'Mağaza Adı' },
  diger: { taksit: true, faiz: true, tekTutar: false, kmh: false, kurumEtiket: 'Kurum / Kişi Adı' },
}

export default function BorcEkleModal() {
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [category, setCategory] = useState('kredi_karti')
  const [institutionName, setInstitutionName] = useState('')

  // Taksitsiz (kredi kartı gibi) borçlar için
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')

  // Taksitli krediler için — YENİ, sadeleştirilmiş girişler
  const [kalanAnapara, setKalanAnapara] = useState('')       // principal_amount
  const [aylikTaksitTutari, setAylikTaksitTutari] = useState('') // aylik_taksit_tutari
  const [kalanTaksitSayisi, setKalanTaksitSayisi] = useState('') // installment_remaining

  const [interestRate, setInterestRate] = useState('') // SADECE kullanıcının elle girdiği/değiştirdiği değer — boşsa otomatik hesap gösterilir
  // KMH için — yıllık faiz kullanıcıdan alınır, aylık karşılığı saklanır (interest_rate her yerde "aylık" anlamına gelir)
  const [kmhLimit, setKmhLimit] = useState('')
  const [kmhYillikFaiz, setKmhYillikFaiz] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const router = useRouter()
  const supabase = createClient()
  const alanlar = KATEGORI_ALANLAR[category]

  // Kullanıcı yazarken canlı önizleme — "işte toplam ne kadar borcun kaldığını" hemen görsün
  const hesaplananToplam = useMemo(() => {
    const tutar = parseFloat(aylikTaksitTutari)
    const sayi = parseInt(kalanTaksitSayisi)
    if (!tutar || !sayi || tutar <= 0 || sayi <= 0) return null
    return tutar * sayi
  }, [aylikTaksitTutari, kalanTaksitSayisi])

  // FAİZ ORANI OTOMATİK TAHMİNİ — Anapara + Taksit Tutarı + Taksit Sayısı doluysa,
  // amortisman formülünün tersini (ikili arama ile) çözüp faiz oranını öneriyoruz.
  // Effect/state senkronizasyonu YOK — kullanıcı elle bir şey yazmadığı sürece (interestRate
  // boşken) ekranda gösterilen ve submit'te kullanılan değer doğrudan bu türetilen değerden
  // geliyor. Kullanıcı elle yazınca interestRate dolar ve bunun önüne geçer.
  const tahminiFaizOrani = useMemo(() => {
    if (!alanlar.taksit || !alanlar.faiz) return null
    const anapara = parseFloat(kalanAnapara)
    const taksit = parseFloat(aylikTaksitTutari)
    const sayi = parseInt(kalanTaksitSayisi)
    if (!anapara || !taksit || !sayi || anapara <= 0 || taksit <= 0 || sayi <= 0) return null
    return faizOraniTahminEt({ anapara, taksitTutari: taksit, taksitSayisi: sayi })
  }, [kalanAnapara, aylikTaksitTutari, kalanTaksitSayisi, alanlar.taksit, alanlar.faiz])

  const otomatikFaizMetni = tahminiFaizOrani !== null ? (tahminiFaizOrani * 100).toFixed(2) : ''
  const gosterilecekFaizOrani = interestRate !== '' ? interestRate : otomatikFaizMetni

  function sifirlaVeKapat() {
    setAcik(false)
    setCategory('kredi_karti'); setInstitutionName(''); setTotalAmount(''); setRemainingAmount('')
    setKalanAnapara(''); setAylikTaksitTutari(''); setKalanTaksitSayisi('')
    setInterestRate(''); setDueDate(''); setMessage('')
    setKmhLimit(''); setKmhYillikFaiz('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı, tekrar giriş yapmalısın.'); return }

    let kayit: Record<string, unknown>

    if (alanlar.kmh) {
      const bakiye = parseFloat(remainingAmount)
      const limit = parseFloat(kmhLimit)
      const yillikFaiz = parseFloat(kmhYillikFaiz)
      if (!bakiye || bakiye < 0) { setMessage('Güncel kullanılan bakiyeyi gir.'); return }
      if (!limit || limit <= 0) { setMessage('Limiti gir.'); return }

      kayit = {
        user_id: user.id, category, institution_name: institutionName,
        total_amount: bakiye, remaining_amount: bakiye,
        installment_total: null, installment_remaining: null, aylik_taksit_tutari: null,
        principal_amount: null, kmh_limit: limit,
        // Kullanıcı yıllık girdi, biz aylık karşılığını saklıyoruz (interest_rate her borçta "aylık" anlamına gelir)
        interest_rate: yillikFaiz ? yillikFaiz / 12 : null,
        due_date: null, status: 'active',
      }
    } else if (alanlar.taksit) {
      // Taksitli kredi — sistem türetiyor
      const tutar = parseFloat(aylikTaksitTutari)
      const sayi = parseInt(kalanTaksitSayisi)
      if (!tutar || tutar <= 0) { setMessage('Aylık taksit tutarını gir.'); return }
      if (!sayi || sayi <= 0) { setMessage('Kalan taksit sayısını gir.'); return }

      const toplamKalan = tutar * sayi // faiz dahil, geri kalan TÜM ödeme yükü

      kayit = {
        user_id: user.id, category, institution_name: institutionName,
        total_amount: toplamKalan, remaining_amount: toplamKalan,
        installment_total: sayi, installment_remaining: sayi,
        aylik_taksit_tutari: tutar,
        principal_amount: alanlar.faiz && kalanAnapara ? parseFloat(kalanAnapara) : null,
        interest_rate: alanlar.faiz && gosterilecekFaizOrani ? parseFloat(gosterilecekFaizOrani) : null,
        due_date: dueDate || null, status: 'active',
      }
    } else {
      // Taksitsiz (kredi kartı vb.) — eskisi gibi
      if (!totalAmount) { setMessage('Tutarı gir.'); return }
      const kesinKalan = alanlar.tekTutar ? totalAmount : remainingAmount
      if (!alanlar.tekTutar && !remainingAmount) { setMessage('Kalan tutarı gir.'); return }

      kayit = {
        user_id: user.id, category, institution_name: institutionName,
        total_amount: parseFloat(totalAmount), remaining_amount: parseFloat(kesinKalan),
        installment_total: null, installment_remaining: null, aylik_taksit_tutari: null,
        interest_rate: alanlar.faiz && gosterilecekFaizOrani ? parseFloat(gosterilecekFaizOrani) : null,
        due_date: dueDate || null, status: 'active',
      }
    }

    setLoading(true)
    const { error } = await supabase.from('debts').insert(kayit)

    if (error) {
      setMessage(hataMesajiCevir(error))
      setLoading(false)
    } else {
      setLoading(false)
      sifirlaVeKapat()
      goster('Borç eklendi.')
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-block bg-navy text-paper text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-navy-light transition-colors"
      >
        + Yeni Borç Ekle
      </button>

      <Modal acik={acik} baslik="Yeni Borç Ekle" onKapat={sifirlaVeKapat}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Borç Türü</label>
            <Secim value={category} onChange={(e) => setCategory(e.target.value)}>
              {BORC_KATEGORILERI.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Secim>
            <p className="text-[11px] text-muted mt-1">
              Kira, elektrik/su/internet faturası gibi her ay tekrar eden ödemelerin mi var? Onları buraya değil,{' '}
              <a href="/dashboard/gelir-gider/duzenli" className="underline text-navy">Gelir-Gider → Düzenli İşlemler</a>'den eklemen daha uygun olur.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">{alanlar.kurumEtiket}</label>
            <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
          </div>

          {alanlar.kmh ? (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Limit (₺)</label>
                  <input type="number" step="0.01" value={kmhLimit} onChange={(e) => setKmhLimit(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Güncel Kullanılan Bakiye (₺)</label>
                  <input type="number" step="0.01" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Yıllık Faiz Oranı (%)</label>
                <input type="number" step="0.01" value={kmhYillikFaiz} onChange={(e) => setKmhYillikFaiz(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                <p className="text-[11px] text-muted mt-1">
                  KMH'de sabit taksit yoktur — istediğin zaman istediğin tutarı ödeyebilirsin. Bu yüzden "taksit" alanı yok.
                </p>
              </div>
            </>
          ) : alanlar.taksit ? (
            <>
              {alanlar.faiz && (
                <div>
                  <label className="text-xs text-muted mb-1 block">Anapara (₺)</label>
                  <input type="number" step="0.01" value={kalanAnapara} onChange={(e) => setKalanAnapara(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                  <p className="text-[11px] text-muted mt-1">
                    Yeni çektiğin bir kredi ise <b>çektiğin tutarı</b> gir. Mevcut, ödemeye devam ettiğin
                    bir kredi ise ekstrende yazan <b>güncel kalan anaparayı</b> gir.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Aylık Taksit Tutarı (₺)</label>
                  <input type="number" step="0.01" value={aylikTaksitTutari} onChange={(e) => setAylikTaksitTutari(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Kalan Taksit Sayısı</label>
                  <input type="number" value={kalanTaksitSayisi} onChange={(e) => setKalanTaksitSayisi(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
                </div>
              </div>
              {hesaplananToplam !== null && (
                <p className="text-xs text-sage bg-sage-soft rounded-lg px-3 py-2">
                  Toplam kalan ödemen: <b className="font-mono">{hesaplananToplam.toLocaleString('tr-TR')} ₺</b> (otomatik hesaplandı)
                </p>
              )}
            </>
          ) : alanlar.tekTutar ? (
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

          {alanlar.faiz && !alanlar.kmh && (
            <div>
              <label className="text-xs text-muted mb-1 block">
                Faiz Oranı (%, aylık) {alanlar.taksit ? '— Erken Kapama Analizi için önemli' : '— opsiyonel'}
              </label>
              <input type="number" step="0.01" value={gosterilecekFaizOrani}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              {alanlar.taksit && tahminiFaizOrani !== null && (
                <p className="text-[11px] text-muted mt-1">
                  {interestRate !== ''
                    ? `Anapara/taksit bilgilerine göre hesaplanan oran %${otomatikFaizMetni}'ydi — sen elle düzelttin, öyle kalacak.`
                    : `Anapara, taksit tutarı ve taksit sayısına göre otomatik hesaplandı. Hatalı olduğunu düşünüyorsan düzenleyebilirsin.`}
                </p>
              )}
            </div>
          )}

          {!alanlar.kmh && (
            <div>
              <label className="text-xs text-muted mb-1 block">
                {!alanlar.taksit ? 'Son Ödeme Tarihi' : 'Sıradaki Taksit Tarihi'}
              </label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Borcu Kaydet'}
          </button>

          {message && <p className="text-xs text-brick mt-1">{message}</p>}
        </form>
      </Modal>
    </>
  )
}

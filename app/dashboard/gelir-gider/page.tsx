'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnayModal from '@/components/OnayModal'
import GelirGiderEkleModal from '@/components/GelirGiderEkleModal'
import CSVIceAktarModal from '@/components/CSVIceAktarModal'
import GelirGiderDuzenleModal from '@/components/GelirGiderDuzenleModal'
import DuzenliIslemlerModal from '@/components/DuzenliIslemlerModal'
import BorcDetayModal from '@/components/BorcDetayModal'
import Secim from '@/components/Secim'

const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// ÖNEMLİ: Tarihleri her zaman metin olarak inşa ediyoruz (Date + toISOString KULLANMIYORUZ),
// çünkü toISOString UTC'ye çeviriyor ve saat dilimine göre günü/ayı bir öncekine kaydırabiliyor.
function ikiBasamakGG(n: number) {
  return String(n).padStart(2, '0')
}
function tarihMetni(yil: number, ayIndex0: number, gun: number) {
  return `${yil}-${ikiBasamakGG(ayIndex0 + 1)}-${ikiBasamakGG(gun)}`
}
function bugunMetni() {
  const n = new Date()
  return tarihMetni(n.getFullYear(), n.getMonth(), n.getDate())
}

const KATEGORI_RENK: Record<string, string> = {
  'Market/Gıda': '#B5533C', 'Ulaşım': '#D98E3F', 'Eğlence': '#7f8ba0', 'Sağlık': '#1B2A4A',
  'Giyim': '#9c7ab5', 'Eğitim': '#4A7C74', 'Kişisel Bakım': '#c98a8a', 'Birikim Aktarımı': '#4A7C74', 'Diğer Gider': '#6b6f7a',
}

type Transaction = {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  transaction_date: string
  description: string | null
  is_recurring: boolean
  recurring_id: string | null
}

type PlanlananTaksit = {
  debtId: string
  kurumAdi: string
  tutar: number
  odendi: boolean
  tarih: string
  gelecek: boolean // bu ay henüz sırası gelmemiş, ileriye dönük gösterim
}

type GercekOdeme = {
  id: string
  debtId: string
  kurumAdi: string
  tutar: number
  tarih: string
}

type PlanlananIslem = {
  id: string
  type: 'income' | 'expense'
  category: string
  description: string | null
  amount: number
  tarih: string
}

function GelirGiderPageIc() {
  const router = useRouter()
  const supabase = createClient()

  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [ilkYuklemeTamam, setIlkYuklemeTamam] = useState(false)
  const [ay, setAy] = useState(() => {
    const p = searchParams.get('ay')
    return p !== null ? parseInt(p) : new Date().getMonth()
  })
  const [yil, setYil] = useState(() => {
    const p = searchParams.get('yil')
    return p !== null ? parseInt(p) : new Date().getFullYear()
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [borcOdemeleri, setBorcOdemeleri] = useState(0)
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set())
  const [deletingTx, setDeletingTx] = useState(false)
  const [onayAcik, setOnayAcik] = useState(false)
  const [hedefler, setHedefler] = useState<{ id: string; goal_name: string; current_amount: number; target_amount: number }[]>([])
  const [oneriKapandi, setOneriKapandi] = useState(false)
  const [oneriHedefId, setOneriHedefId] = useState('')
  const [oneriTutar, setOneriTutar] = useState('')
  const [oneriYukleniyor, setOneriYukleniyor] = useState(false)
  const [devredenBakiye, setDevredenBakiye] = useState(0)
  const [planlananTaksitler, setPlanlananTaksitler] = useState<PlanlananTaksit[]>([])
  const [gercekOdemeler, setGercekOdemeler] = useState<GercekOdeme[]>([])
  const [planlananIslemler, setPlanlananIslemler] = useState<PlanlananIslem[]>([])
  const [yilOzet, setYilOzet] = useState<Record<number, { gelir: number; gider: number }>>({})
  const [takvimAcik, setTakvimAcik] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const baslangic = new Date(yil, ay, 1) // sadece payments (gerçek zaman damgası) sorguları için kullanılacak
    const bitis = new Date(yil, ay + 1, 1)
    const baslangicStr = tarihMetni(yil, ay, 1)
    const ayinSonGunuBuAy = new Date(yil, ay + 1, 0).getDate()
    const bitisAyIcinYilAy = ay === 11 ? { y: yil + 1, a: 0 } : { y: yil, a: ay + 1 }
    const bitisStr = tarihMetni(bitisAyIcinYilAy.y, bitisAyIcinYilAy.a, 1)
    const bugunStr = bugunMetni()

    // 1) Bu ay için mevcut işlemleri çek
    let { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('transaction_date', baslangicStr)
      .lt('transaction_date', bitisStr)
      .order('transaction_date', { ascending: false })

    // 2) Aktif düzenli işlem şablonlarını çek, bu ay için henüz üretilmemişse otomatik oluştur
    const { data: recurringItems } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .lte('start_date', bitisStr)

    const mevcutRecurringIdleri = new Set((txData || []).map((t) => t.recurring_id).filter(Boolean))
    const sonGun = new Date(yil, ay + 1, 0).getDate()

    let yeniEklendi = false
    const buAyPlanliIslemler: PlanlananIslem[] = []

    for (const item of recurringItems || []) {
      if (mevcutRecurringIdleri.has(item.id)) continue
      const gun = Math.min(item.day_of_month, sonGun)
      const hedefTarihStr = tarihMetni(yil, ay, gun)

      // Şablonun oluşturulduğu AY ile hedef ay karşılaştırılır (gün bazlı değil).
      const hedefAy = `${yil}-${String(ay + 1).padStart(2, '0')}`
      const baslangicAy = item.start_date.slice(0, 7)
      if (hedefAy < baslangicAy) continue

      if (hedefTarihStr > bugunStr) {
        // Henüz gerçekleşmemiş — kayıt oluşturmuyoruz, sadece "planlı" olarak gösteriyoruz.
        buAyPlanliIslemler.push({
          id: item.id,
          type: item.type,
          category: item.category,
          description: item.description,
          amount: item.amount,
          tarih: hedefTarihStr,
        })
        continue
      }

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: item.type,
        category: item.category,
        amount: item.amount,
        transaction_date: hedefTarihStr,
        description: item.description,
        is_recurring: true,
        recurring_id: item.id,
      })
      yeniEklendi = true
    }
    setPlanlananIslemler(buAyPlanliIslemler)

    if (yeniEklendi) {
      const { data: yenilenmisTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('transaction_date', baslangicStr)
        .lt('transaction_date', bitisStr)
        .order('transaction_date', { ascending: false })
      txData = yenilenmisTx
    }

    setTransactions(txData || [])
    setSelectedTx(new Set())

    // 3) Geçmişte atlanmış aylar için düzenli kayıtları tamamla (devreden bakiyenin doğru olması için)
    const { data: tumRecurring } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)

    if (tumRecurring && tumRecurring.length > 0) {
      const itemIds = tumRecurring.map((it) => it.id)
      const { data: mevcutRecurringTx } = await supabase
        .from('transactions')
        .select('recurring_id, transaction_date')
        .in('recurring_id', itemIds)

      const mevcutSet = new Set(
        (mevcutRecurringTx || []).map((t) => `${t.recurring_id}_${t.transaction_date.slice(0, 7)}`)
      )

      const eklenecekler: { user_id: string; type: string; category: string; amount: number; transaction_date: string; description: string | null; is_recurring: boolean; recurring_id: string }[] = []

      for (const item of tumRecurring) {
        const baslangicTarih = new Date(item.start_date)
        let tarayiciYil = baslangicTarih.getFullYear()
        let tarayiciAy = baslangicTarih.getMonth()
        let guvenlikSayaci = 0

        // Şablonun başladığı aydan, GÖRÜNTÜLENEN ayın BİR ÖNCESİNE kadar tara (görüntülenen ay zaten yukarıda işlendi)
        while ((tarayiciYil < yil || (tarayiciYil === yil && tarayiciAy < ay)) && guvenlikSayaci < 60) {
          guvenlikSayaci++
          const anahtar = `${item.id}_${tarayiciYil}-${String(tarayiciAy + 1).padStart(2, '0')}`
          if (!mevcutSet.has(anahtar)) {
            const ayinSonGunu = new Date(tarayiciYil, tarayiciAy + 1, 0).getDate()
            const gun = Math.min(item.day_of_month, ayinSonGunu)
            const hedefTarihStr = tarihMetni(tarayiciYil, tarayiciAy, gun)
            if (hedefTarihStr <= bugunStr && hedefTarihStr >= item.start_date) {
              eklenecekler.push({
                user_id: user.id,
                type: item.type,
                category: item.category,
                amount: item.amount,
                transaction_date: hedefTarihStr,
                description: item.description,
                is_recurring: true,
                recurring_id: item.id,
              })
            }
          }
          tarayiciAy++
          if (tarayiciAy > 11) { tarayiciAy = 0; tarayiciYil++ }
        }
      }

      if (eklenecekler.length > 0) {
        await supabase.from('transactions').insert(eklenecekler)
      }
    }

    // 4) Devreden bakiye: görüntülenen aydan ÖNCEKİ tüm zamanların toplamı
    const { data: gecmisTx } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .lt('transaction_date', baslangicStr)

    const gecmisGelir = (gecmisTx || []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const gecmisGider = (gecmisTx || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    let gecmisBorcOdemesi = 0
    // (debtIds birazdan aşağıda tanımlanıyor, o yüzden burada tekrar çekiyoruz)
    const { data: debtIdsIcinGecmis } = await supabase.from('debts').select('id').eq('user_id', user.id)
    const gecmisDebtIds = (debtIdsIcinGecmis || []).map((d) => d.id)
    if (gecmisDebtIds.length > 0) {
      const { data: gecmisPayments } = await supabase
        .from('payments')
        .select('amount')
        .in('debt_id', gecmisDebtIds)
        .lt('paid_at', baslangic.toISOString())
      gecmisBorcOdemesi = (gecmisPayments || []).reduce((s, p) => s + Number(p.amount), 0)
    }

    setDevredenBakiye(gecmisGelir - gecmisGider - gecmisBorcOdemesi)

    // 5) Bu ay yapılan borç ödemelerini hesaba kat (zaten canlı/otomatik)
    const { data: debts } = await supabase.from('debts').select('id').eq('user_id', user.id)
    const debtIds = (debts || []).map((d) => d.id)

    if (debtIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .in('debt_id', debtIds)
        .gte('paid_at', baslangic.toISOString())
        .lt('paid_at', bitis.toISOString())

      const toplam = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
      setBorcOdemeleri(toplam)

      // Gerçek ödemeleri tek tek de çek — İşlemler listesinde ayrı satır olarak göstereceğiz
      const { data: tumBorclarIsim } = await supabase.from('debts').select('id, institution_name').eq('user_id', user.id)
      const isimMap = new Map((tumBorclarIsim || []).map((d) => [d.id, d.institution_name]))

      const { data: detayliOdemeler } = await supabase
        .from('payments')
        .select('id, amount, paid_at, debt_id')
        .in('debt_id', debtIds)
        .gte('paid_at', baslangic.toISOString())
        .lt('paid_at', bitis.toISOString())
        .order('paid_at', { ascending: false })

      setGercekOdemeler(
        (detayliOdemeler || []).map((p) => ({
          id: p.id,
          debtId: p.debt_id,
          kurumAdi: isimMap.get(p.debt_id) || 'Borç',
          tutar: Number(p.amount),
          tarih: p.paid_at,
        }))
      )
    } else {
      setBorcOdemeleri(0)
      setGercekOdemeler([])
    }

    // 6) Planlanan borç taksitleri: due_date'ten başlayıp kalan taksit sayısı kadar İLERİYE dönük tüm ayları kapsar.
    // Böylece sadece "sıradaki" ay değil, borcun bittiği aya kadar her ay kendi taksitini gösterir.
    const { data: aktifBorclar } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('due_date', 'is', null)

    const buAyPlanlar: PlanlananTaksit[] = []
    const goruntulenenAyIndex = yil * 12 + ay

    for (const borc of aktifBorclar || []) {
      if (!borc.due_date) continue
      if (!borc.installment_total || !borc.installment_remaining) continue // sadece taksitli, kalanı olan borçlar

      const [dueY, dueM] = borc.due_date.slice(0, 7).split('-').map(Number)
      const dueAyIndex = dueY * 12 + (dueM - 1)
      const offset = goruntulenenAyIndex - dueAyIndex

      if (offset < 0 || offset >= borc.installment_remaining) continue // bu ay bu borcun kapsamında değil

      const taksitTutari = borc.prepayment_strategy === 'taksit_dussun'
        ? Number(borc.remaining_amount) / borc.installment_remaining
        : Number(borc.total_amount) / borc.installment_total

      let odendi = false
      if (offset === 0) {
        // Bu, "sırası gelmiş" taksit — gerçekten ödenmiş mi kontrol et
        const { data: buAyOdemeleri } = await supabase
          .from('payments')
          .select('amount')
          .eq('debt_id', borc.id)
          .gte('paid_at', baslangic.toISOString())
          .lt('paid_at', bitis.toISOString())
        const buAyOdenen = (buAyOdemeleri || []).reduce((s, p) => s + Number(p.amount), 0)
        odendi = buAyOdenen >= taksitTutari - 1
      }

      // Bu ay zaten gerçek bir ödeme yapılmışsa (offset===0 ve odendi), o zaten "gerçek ödemeler" listesinde ayrı görünecek — burada tekrar eklemeyelim.
      if (offset === 0 && odendi) continue

      buAyPlanlar.push({
        debtId: borc.id,
        kurumAdi: borc.institution_name,
        tutar: taksitTutari,
        odendi,
        tarih: borc.due_date,
        gelecek: offset > 0,
      })
    }
    setPlanlananTaksitler(buAyPlanlar)

    const { data: hedefVerisi } = await supabase
      .from('savings_goals')
      .select('id, goal_name, current_amount, target_amount')
      .eq('user_id', user.id)
    setHedefler(hedefVerisi || [])

    setLoading(false)
    setIlkYuklemeTamam(true)
  }, [ay, yil])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchYilOzet = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const yilBaslangic = tarihMetni(yil, 0, 1)
    const yilBitis = tarihMetni(yil + 1, 0, 1)

    const { data: yilTx } = await supabase
      .from('transactions')
      .select('type, amount, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', yilBaslangic)
      .lt('transaction_date', yilBitis)

    const { data: debtIdsData } = await supabase.from('debts').select('id').eq('user_id', user.id)
    const debtIds = (debtIdsData || []).map((d) => d.id)

    let yilPayments: { amount: number; paid_at: string }[] = []
    if (debtIds.length > 0) {
      const { data } = await supabase
        .from('payments')
        .select('amount, paid_at')
        .in('debt_id', debtIds)
        .gte('paid_at', new Date(yil, 0, 1).toISOString())
        .lt('paid_at', new Date(yil + 1, 0, 1).toISOString())
      yilPayments = data || []
    }

    const ozet: Record<number, { gelir: number; gider: number }> = {}
    for (let i = 0; i < 12; i++) ozet[i] = { gelir: 0, gider: 0 }

    for (const t of yilTx || []) {
      const ayIndex = parseInt(t.transaction_date.slice(5, 7)) - 1 // "YYYY-MM-DD" -> ay index, saat dilimine bağlı değil
      if (t.type === 'income') ozet[ayIndex].gelir += Number(t.amount)
      else ozet[ayIndex].gider += Number(t.amount)
    }
    for (const p of yilPayments) {
      const ayIndex = new Date(p.paid_at).getMonth() // paid_at gerçek zaman damgası, bu doğru
      ozet[ayIndex].gider += Number(p.amount)
    }

    setYilOzet(ozet)
  }, [yil])

  useEffect(() => { fetchYilOzet() }, [fetchYilOzet])

  function ayRengi(ayIndex: number): string {
    const veri = yilOzet[ayIndex]
    if (!veri || (veri.gelir === 0 && veri.gider === 0)) return 'bg-white border-border text-muted'
    if (veri.gider === 0) return 'bg-sage text-white border-sage' // sadece gelir var, gider yok — tam yeşil

    const oran = veri.gelir / veri.gider // 1'in üstü: gelir gideri karşılıyor
    if (oran >= 1) {
      const fazlalik = Math.min((oran - 1), 1) // %100 fazlaya kadar doluluk artar
      const opacity = 0.15 + fazlalik * 0.45 // 0.15 - 0.60 arası, çok koyu olmasın
      return `text-navy border-sage`
    } else {
      const acik = Math.min((1 - oran), 1)
      const opacity = 0.15 + acik * 0.45
      return `text-navy border-brick`
    }
  }

  function ayStilInline(ayIndex: number): React.CSSProperties {
    const veri = yilOzet[ayIndex]
    if (!veri || (veri.gelir === 0 && veri.gider === 0)) return {}
    if (veri.gider === 0) return {}
    const oran = veri.gelir / veri.gider
    if (oran >= 1) {
      const fazlalik = Math.min((oran - 1), 1)
      const opacity = 0.15 + fazlalik * 0.45
      return { backgroundColor: `rgba(74, 124, 116, ${opacity})` }
    } else {
      const acik = Math.min((1 - oran), 1)
      const opacity = 0.15 + acik * 0.45
      return { backgroundColor: `rgba(181, 83, 60, ${opacity})` }
    }
  }

  async function hedefeAktar() {
    const tutar = parseFloat(oneriTutar)
    if (!oneriHedefId || !tutar || tutar <= 0) return

    setOneriYukleniyor(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setOneriYukleniyor(false); return }

    const hedef = hedefler.find((h) => h.id === oneriHedefId)
    if (!hedef) { setOneriYukleniyor(false); return }

    const { error } = await supabase.rpc('gelir_gider_ekle_ve_aktar', {
      p_user_id: user.id,
      p_type: 'expense',
      p_category: 'Birikim Aktarımı',
      p_amount: tutar,
      p_transaction_date: bugunMetni(),
      p_description: hedef.goal_name,
      p_is_recurring: false,
      p_recurring_id: null,
      p_goal_id: oneriHedefId,
      p_goal_direction: 'add',
    })

    if (error) { setOneriYukleniyor(false); return }

    setOneriYukleniyor(false)
    setOneriHedefId('')
    setOneriTutar('')
    fetchData()
  }

  function oncekiAy() {
    if (ay === 0) { setAy(11); setYil(yil - 1) } else { setAy(ay - 1) }
  }
  function sonrakiAy() {
    if (ay === 11) { setAy(0); setYil(yil + 1) } else { setAy(ay + 1) }
  }

  function toggleTxSelection(txId: string) {
    setSelectedTx((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) next.delete(txId)
      else next.add(txId)
      return next
    })
  }

  function handleDeleteSelectedTx() {
    if (selectedTx.size === 0) return
    setOnayAcik(true)
  }

  const secilenlerdeDuzenliVarMi = transactions.some((t) => selectedTx.has(t.id) && (t.is_recurring || t.recurring_id))

  async function gercekTxSil() {
    setOnayAcik(false)
    setDeletingTx(true)
    await supabase.from('transactions').delete().in('id', Array.from(selectedTx))
    setDeletingTx(false)
    fetchData()
  }

  // "Birikimden Çekim" gerçek bir gelir değil — kendi biriktirdiğin parayı geri almak.
  // Bu yüzden Gelir'e saymıyoruz, bunun yerine aynı ayki "Birikim Aktarımı" giderinden düşüyoruz (net biriktirdiğini gösteriyor).
  const birikimdenCekimToplami = transactions.filter((t) => t.type === 'income' && t.category === 'Birikimden Çekim').reduce((s, t) => s + Number(t.amount), 0)
  const toplamGelir = transactions.filter((t) => t.type === 'income' && t.category !== 'Birikimden Çekim').reduce((s, t) => s + Number(t.amount), 0)
  const manuelGider = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) - birikimdenCekimToplami
  const netDurum = toplamGelir - manuelGider - borcOdemeleri

  const giderKategorileri: { label: string; tutar: number; renk: string }[] = []
  const giderMap: Record<string, number> = {}
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    giderMap[t.category] = (giderMap[t.category] || 0) + Number(t.amount)
  })
  // "Birikimden Çekim" gelirini, aynı ayki "Birikim Aktarımı" giderinden düşerek net göster
  if (birikimdenCekimToplami > 0 && giderMap['Birikim Aktarımı']) {
    giderMap['Birikim Aktarımı'] = Math.max(0, giderMap['Birikim Aktarımı'] - birikimdenCekimToplami)
  }
  Object.entries(giderMap).forEach(([kategori, tutar]) => {
    if (tutar <= 0) return
    giderKategorileri.push({ label: kategori, tutar, renk: KATEGORI_RENK[kategori] || '#6b6f7a' })
  })
  if (borcOdemeleri > 0) {
    giderKategorileri.push({ label: 'Borç Ödemeleri', tutar: borcOdemeleri, renk: '#1B2A4A' })
  }
  const enBuyukGider = Math.max(...giderKategorileri.map((g) => g.tutar), 1)

  if (loading && !ilkYuklemeTamam) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  return (
    <main className={`max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>

        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setYil(yil - 1)} className="text-navy text-sm px-3 py-1.5 rounded-md hover:bg-white transition-colors">← {yil - 1}</button>
          <h1 className="text-lg font-medium text-navy">{AY_ISIMLERI[ay]} {yil}</h1>
          <button onClick={() => setYil(yil + 1)} className="text-navy text-sm px-3 py-1.5 rounded-md hover:bg-white transition-colors">{yil + 1} →</button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {AY_ISIMLERI.map((isim, index) => {
            const secili = index === ay
            return (
              <button
                key={isim}
                onClick={() => setAy(index)}
                style={ayStilInline(index)}
                className={`rounded-lg border py-3 text-xs font-medium transition-all ${ayRengi(index)} ${
                  secili ? 'ring-2 ring-navy ring-offset-1' : ''
                }`}
              >
                {isim.slice(0, 3)}
              </button>
            )
          })}
        </div>

        <p className="text-sm text-muted mb-1">
          Toplam Bakiyen {devredenBakiye !== 0 && `(devreden: ${devredenBakiye.toLocaleString('tr-TR')} ₺)`}
        </p>
        <p className={`font-mono text-5xl font-medium tracking-tight mb-6 ${devredenBakiye + netDurum >= 0 ? 'text-navy' : 'text-brick'}`}>
          {(devredenBakiye + netDurum).toLocaleString('tr-TR')} ₺
        </p>

        {(() => {
          const buAyOdenmemisBorc = planlananTaksitler.filter((p) => !p.gelecek).reduce((s, p) => s + p.tutar, 0)
          if (buAyOdenmemisBorc <= 0) return null
          const tahmini = devredenBakiye + netDurum - buAyOdenmemisBorc
          return (
            <div className="rounded-lg p-3 border border-dashed border-border bg-white mb-6">
              <p className="text-[11px] text-muted mb-0.5">
                Tahmini Ay Sonu Bakiyesi — bu ayki {buAyOdenmemisBorc.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ borcunu da ödersen
              </p>
              <p className={`font-mono text-base font-medium ${tahmini >= 0 ? 'text-navy' : 'text-brick'}`}>
                {tahmini.toLocaleString('tr-TR')} ₺
              </p>
            </div>
          )
        })()}

        {(() => {
          const su = new Date()
          const gercekAy = su.getMonth()
          const gercekYil = su.getFullYear()
          const buGercekAy = ay === gercekAy && yil === gercekYil
          const kullanilabilirBakiye = devredenBakiye + netDurum
          return buGercekAy && kullanilabilirBakiye > 0 && hedefler.length > 0 && !oneriKapandi
        })() && (
          <div className="rounded-lg p-4 border border-sage bg-sage-soft mb-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-navy">
                Şu an kullanılabilir <span className="font-mono font-medium">{(devredenBakiye + netDurum).toLocaleString('tr-TR')} ₺</span> var (devreden + bu ay). Bir hedefe aktarmak ister misin?
              </p>
              <button onClick={() => setOneriKapandi(true)} className="text-muted text-xs shrink-0 ml-2" aria-label="Kapat">✕</button>
            </div>
            <div className="flex flex-col gap-2">
              <Secim
                value={oneriHedefId}
                onChange={(e) => {
                  setOneriHedefId(e.target.value)
                  if (!oneriTutar) setOneriTutar(String(devredenBakiye + netDurum))
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
              >
                <option value="">Hedef seç...</option>
                {hedefler.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.goal_name} ({Number(h.current_amount).toLocaleString('tr-TR')} / {Number(h.target_amount).toLocaleString('tr-TR')} ₺){Number(h.current_amount) >= Number(h.target_amount) ? ' ✓' : ''}
                  </option>
                ))}
              </Secim>
              {oneriHedefId && (
                <div className="flex gap-2">
                  <input
                    type="number" step="0.01" value={oneriTutar}
                    onChange={(e) => setOneriTutar(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
                  />
                  <button
                    onClick={hedefeAktar}
                    disabled={oneriYukleniyor}
                    className="bg-sage text-white text-sm font-medium rounded-lg px-4 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {oneriYukleniyor ? 'Aktarılıyor...' : 'Aktar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Bu Ay Gelir</p>
            <p className="font-mono text-lg text-sage font-medium">{toplamGelir.toLocaleString('tr-TR')} ₺</p>
            {planlananIslemler.some((p) => p.type === 'income') && (
              <p className="text-[11px] text-amber mt-1">
                + {planlananIslemler.filter((p) => p.type === 'income').reduce((s, p) => s + Number(p.amount), 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ planlı (henüz gelmedi)
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Bu Ay Diğer Gider</p>
            <p className="font-mono text-lg text-brick font-medium">{manuelGider.toLocaleString('tr-TR')} ₺</p>
            {planlananIslemler.some((p) => p.type === 'expense') && (
              <p className="text-[11px] text-amber mt-1">
                + {planlananIslemler.filter((p) => p.type === 'expense').reduce((s, p) => s + Number(p.amount), 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ planlı (henüz ödenmedi)
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Bu Ay Borç Ödemesi</p>
            <p className="font-mono text-lg text-navy font-medium">{borcOdemeleri.toLocaleString('tr-TR')} ₺</p>
            {planlananTaksitler.length > 0 && (
              <p className="text-[11px] text-amber mt-1">
                + {planlananTaksitler.reduce((s, p) => s + p.tutar, 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ planlı (henüz ödenmedi)
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg p-4 border border-border">
            <p className="text-xs text-muted mb-1">Bu Ay Net</p>
            <p className={`font-mono text-lg font-medium ${netDurum >= 0 ? 'text-sage' : 'text-brick'}`}>
              {netDurum.toLocaleString('tr-TR')} ₺
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <GelirGiderEkleModal hedefAy={ay} hedefYil={yil} onBasarili={fetchData} />
          <DuzenliIslemlerModal onBasarili={fetchData} />
          <CSVIceAktarModal onBasarili={fetchData} />
        </div>

        {giderKategorileri.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted mb-3">Gider Dağılımı</h2>
            <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5">
              {giderKategorileri.sort((a, b) => b.tutar - a.tutar).map((g) => (
                <div key={g.label} className="flex items-center gap-3">
                  <span className="text-xs text-navy w-32 shrink-0">{g.label}</span>
                  <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                    <div style={{ width: `${(g.tutar / enBuyukGider) * 100}%`, backgroundColor: g.renk }} className="h-full rounded-full" />
                  </div>
                  <span className="font-mono text-xs text-muted w-20 text-right shrink-0">{g.tutar.toLocaleString('tr-TR')} ₺</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">İşlemler</h2>
          {selectedTx.size > 0 && (
            <button
              onClick={handleDeleteSelectedTx}
              disabled={deletingTx}
              className="text-xs text-brick font-medium hover:underline disabled:opacity-60"
            >
              {deletingTx ? 'Siliniyor...' : `Seçilenleri Sil (${selectedTx.size})`}
            </button>
          )}
        </div>
        {transactions.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTx.size === transactions.length}
              onChange={(e) => {
                if (e.target.checked) setSelectedTx(new Set(transactions.map((t) => t.id)))
                else setSelectedTx(new Set())
              }}
            />
            Tümünü seç ({transactions.length} işlem)
          </label>
        )}
        {transactions.length === 0 && planlananTaksitler.length === 0 && gercekOdemeler.length === 0 && planlananIslemler.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Bu ay henüz işlem eklenmedi. Gelir veya gider ekleyerek başla.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 ${
                  t.type === 'income' ? 'border-sage' : 'border-brick'
                } ${selectedTx.has(t.id) ? 'ring-1 ring-brick' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedTx.has(t.id)}
                  onChange={() => toggleTxSelection(t.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">
                    {t.category}
                    {(t.is_recurring || t.recurring_id) && <span className="ml-1.5 text-[10px] text-muted">↻ düzenli</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {t.description ? `${t.description} · ` : ''}
                    {new Date(t.transaction_date).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <span className={`font-mono text-sm shrink-0 ${t.type === 'income' ? 'text-sage' : 'text-brick'}`}>
                  {t.type === 'income' ? '+' : '−'}{Number(t.amount).toLocaleString('tr-TR')} ₺
                </span>
                <GelirGiderDuzenleModal txId={t.id} onBasarili={fetchData} />
              </div>
            ))}

            {gercekOdemeler.map((g) => (
              <div key={`odeme-${g.id}`} className="bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 border-sage">
                <span className="w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">
                    Borç Taksiti
                    <span className="ml-1.5 text-[10px] text-muted">↻ borç</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {g.kurumAdi} · {new Date(g.tarih).toLocaleDateString('tr-TR')} <span className="text-sage">· ✓ Ödendi</span>
                  </p>
                </div>
                <span className="font-mono text-sm shrink-0 text-sage">
                  −{g.tutar.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </span>
                <BorcDetayModal debtId={g.debtId} onBasarili={fetchData} tetikleyici={<span className="shrink-0 text-muted hover:text-navy p-1 cursor-pointer" aria-label="Borca git">✎</span>} />
              </div>
            ))}

            {planlananTaksitler.map((p) => (
              <div
                key={`borc-${p.debtId}`}
                className={`bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 ${
                  p.odendi ? 'border-sage' : p.gelecek ? 'border-border' : 'border-brick'
                }`}
              >
                <span className="w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">
                    Borç Taksiti
                    <span className="ml-1.5 text-[10px] text-muted">↻ borç</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {p.kurumAdi}
                    {p.odendi && <span className="text-sage"> · ✓ Ödendi</span>}
                    {!p.odendi && !p.gelecek && <span className="text-brick"> · Bu ay ödenecek</span>}
                    {!p.odendi && p.gelecek && <span className="text-muted"> · Planlı (henüz gelmedi)</span>}
                  </p>
                </div>
                <span className={`font-mono text-sm shrink-0 ${p.odendi ? 'text-sage' : p.gelecek ? 'text-muted' : 'text-brick'}`}>
                  −{p.tutar.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </span>
                <BorcDetayModal debtId={p.debtId} onBasarili={fetchData} tetikleyici={<span className="shrink-0 text-muted hover:text-navy p-1 cursor-pointer" aria-label="Borca git">✎</span>} />
              </div>
            ))}

            {planlananIslemler.map((p) => (
              <div
                key={`planli-${p.id}`}
                className="bg-white rounded-lg pl-3 pr-4 py-3 flex items-center gap-3 border-l-4 border-border"
              >
                <span className="w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">
                    {p.category}
                    <span className="ml-1.5 text-[10px] text-muted">↻ düzenli</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {p.description ? `${p.description} · ` : ''}
                    {new Date(p.tarih).toLocaleDateString('tr-TR')}
                    <span className="text-muted"> · Planlı (henüz gelmedi)</span>
                  </p>
                </div>
                <span className="font-mono text-sm shrink-0 text-muted">
                  {p.type === 'income' ? '+' : '−'}{Number(p.amount).toLocaleString('tr-TR')} ₺
                </span>
                <span className="w-6 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Emin misin?"
        mesaj={
          secilenlerdeDuzenliVarMi
            ? `${selectedTx.size} kaydı silmek istediğine emin misin? Not: seçtiklerinden biri düzenli bir işlemin bu aya ait kaydı — sadece bu kaydı siliyorsun, şablon hâlâ aktifse bir sonraki ay tekrar otomatik oluşacak. Şablonu tamamen durdurmak istersen "Düzenli İşlemler" sayfasından "Pasif Et" veya "Sil" yapman gerekir.`
            : `${selectedTx.size} kaydı silmek istediğine emin misin?`
        }
        onOnayla={gercekTxSil}
        onVazgec={() => setOnayAcik(false)}
      />
    
  )
}

export default function GelirGiderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>}>
      <GelirGiderPageIc />
    </Suspense>
  )
}

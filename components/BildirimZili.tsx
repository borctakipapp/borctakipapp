'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import BorcDetayModal from '@/components/BorcDetayModal'
import DuzenliIslemlerModal from '@/components/DuzenliIslemlerModal'
import ReceivableDetayModal, { type Receivable } from '@/components/ReceivableDetayModal'
import { bildirimleriHesapla, giderKategorileriHesapla, ikiBasamak, type HesaplananBildirim } from '@/lib/finans-motoru'

const RENK_HARITASI: Record<string, string> = {} // bütçe hesabı için renk önemli değil, sadece tutar lazım

function tarihStr(d: Date): string {
  return `${d.getFullYear()}-${ikiBasamak(d.getMonth() + 1)}-${ikiBasamak(d.getDate())}`
}

export default function BildirimZili() {
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [bildirimler, setBildirimler] = useState<HesaplananBildirim[]>([])
  const [receivableMap, setReceivableMap] = useState<Record<string, Receivable>>({})
  const [kullaniciId, setKullaniciId] = useState('')
  const kutuRef = useRef<HTMLDivElement>(null)
  // BildirimZili, layout'ta hem mobil hem masaüstü sürümünde (CSS ile gizli/görünür) aynı anda
  // DOM'da mevcut oluyor — iki ayrı örnek aynı Realtime kanal ismini kullanırsa Supabase istemcisi
  // çakışıp hata veriyordu. Her örneğe kendi rastgele kimliğini veriyoruz.
  const ornekIdRef = useRef(Math.random().toString(36).slice(2))

  const fetchBildirimler = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setYukleniyor(false); return }
    setKullaniciId(user.id)

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const esikTarih = new Date(bugun)
    esikTarih.setDate(esikTarih.getDate() + 5)
    const esikTarihStr = tarihStr(esikTarih)
    const ayBaslangic = `${bugun.getFullYear()}-${ikiBasamak(bugun.getMonth() + 1)}-01`

    // DB seviyesinde filtre: sadece eşik tarihine kadar olanları çek (client-side'da
    // tüm aktif kayıtları çekip filtrelemek yerine) — modül sayısı arttıkça bu önemli.
    const [
      { data: debts, error: debtsHata },
      { data: duzenliler, error: duzenliHata },
      { data: receivables, error: receivablesHata },
      { data: limitler, error: limitlerHata },
      { data: buAyIslemler, error: islemlerHata },
    ] = await Promise.all([
      supabase.from('debts').select('id, institution_name, remaining_amount, due_date')
        .eq('user_id', user.id).eq('status', 'active').not('due_date', 'is', null).lte('due_date', esikTarihStr),
      supabase.from('recurring_items').select('id, category, description, amount, day_of_month')
        .eq('user_id', user.id).eq('type', 'expense').eq('active', true),
      supabase.from('receivables').select('id, contact_name, description, total_amount, remaining_amount, expected_date, status, closed_at')
        .eq('user_id', user.id).eq('status', 'pending').not('expected_date', 'is', null).lte('expected_date', esikTarihStr),
      supabase.from('harcama_limitleri').select('category, aylik_limit').eq('user_id', user.id),
      supabase.from('transactions').select('type, category, amount, transaction_date')
        .eq('user_id', user.id).eq('type', 'expense').gte('transaction_date', ayBaslangic),
    ])

    // TEŞHİS: önceden bu hatalar sessizce yutuluyordu (sadece `data` okunuyordu, `error`
    // hiç kontrol edilmiyordu) — düzenli işlem/alacak bildirimlerinin neden görünmediğini
    // tespit edemiyorduk. Artık her sorgu hatası konsola düşüyor, kaynağı net görünüyor.
    if (debtsHata) console.error('[BildirimZili] debts sorgu hatası:', debtsHata)
    if (duzenliHata) console.error('[BildirimZili] recurring_items sorgu hatası:', duzenliHata)
    if (receivablesHata) console.error('[BildirimZili] receivables sorgu hatası:', receivablesHata)
    if (limitlerHata) console.error('[BildirimZili] harcama_limitleri sorgu hatası:', limitlerHata)
    if (islemlerHata) console.error('[BildirimZili] transactions sorgu hatası:', islemlerHata)

    // Düzenli işlemlerin "sonraki tarihi" DB'de yok, TS'de hesaplanıyor — bu yüzden hepsini
    // çekip motor fonksiyonuna bırakıyoruz (motor zaten 5 gün eşiğini kendi içinde uyguluyor).
    const harcamaLimitleriMap: Record<string, number> = {}
    ;(limitler || []).forEach((l) => { harcamaLimitleriMap[l.category] = Number(l.aylik_limit) })

    const { liste: buAyGiderKategorileri } = giderKategorileriHesapla(buAyIslemler || [], RENK_HARITASI, Infinity)

    const harita: Record<string, Receivable> = {}
    ;(receivables || []).forEach((r) => { harita[r.id] = r })
    setReceivableMap(harita)

    const hepsi = bildirimleriHesapla(
      debts || [], duzenliler || [], receivables || [], buAyGiderKategorileri, harcamaLimitleriMap, bugun,
    )
    setBildirimler(hepsi)
    setYukleniyor(false)
  }, [])

  useEffect(() => { fetchBildirimler() }, [fetchBildirimler])

  // Periyodik yenileme (2 dakikada bir — gün değişimi/gecikme durumunu da günceller) + Realtime
  useEffect(() => {
    const zamanlayici = setInterval(fetchBildirimler, 2 * 60 * 1000)
    return () => clearInterval(zamanlayici)
  }, [fetchBildirimler])

  useEffect(() => {
    if (!kullaniciId) return
    const kanal = supabase
      .channel(`bildirimler-${kullaniciId}-${ornekIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts', filter: `user_id=eq.${kullaniciId}` }, () => fetchBildirimler())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_items', filter: `user_id=eq.${kullaniciId}` }, () => fetchBildirimler())
      .subscribe()

    return () => { supabase.removeChannel(kanal) }
  }, [kullaniciId, fetchBildirimler])

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', disaTikla)
    return () => document.removeEventListener('mousedown', disaTikla)
  }, [])

  function gunEtiketi(b: HesaplananBildirim) {
    if (b.tur === 'butce_asildi') return { metin: `${b.tutar.toLocaleString('tr-TR')} ₺ aşıldı`, renk: 'text-brick' }
    const gunKaldi = b.gunKaldi ?? 0
    if (gunKaldi < 0) return { metin: `${Math.abs(gunKaldi)} gün gecikti`, renk: 'text-brick' }
    if (gunKaldi === 0) return { metin: 'Bugün', renk: 'text-brick' }
    if (gunKaldi === 1) return { metin: 'Yarın', renk: 'text-amber' }
    return { metin: `${gunKaldi} gün kaldı`, renk: 'text-amber' }
  }

  return (
    <div className="relative" ref={kutuRef}>
      <button
        onClick={() => setAcik((a) => !a)}
        className="relative p-1.5"
        aria-label="Bildirimler"
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="text-paper/80 hover:text-paper md:text-navy/70 md:hover:text-navy transition-colors"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {!yukleniyor && bildirimler.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brick text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
            {bildirimler.length}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-border z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs font-medium text-navy">Yaklaşan Ödemeler</p>
          </div>
          {yukleniyor ? (
            <p className="px-4 py-4 text-xs text-muted">Yükleniyor...</p>
          ) : bildirimler.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted">Yaklaşan bir ödemen yok. 🎉</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {bildirimler.map((b) => {
                const etiket = gunEtiketi(b)
                const rozet = b.tur === 'duzenli_yaklasan' ? '↻' : b.tur === 'butce_asildi' ? '🎯' : b.tur.startsWith('alacak') ? '↙' : ''
                const satir = (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper transition-colors cursor-pointer">
                    <Monogram isim={b.baslik} boyut={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy font-medium truncate">
                        {b.baslik} {rozet && <span className="text-[10px] text-muted">{rozet}</span>}
                      </p>
                      <p className={`text-[11px] ${etiket.renk}`}>{etiket.metin}</p>
                    </div>
                    <span className="font-mono text-xs text-navy shrink-0">
                      {b.tur === 'butce_asildi' ? b.altBaslik : `${b.tutar.toLocaleString('tr-TR')} ₺`}
                    </span>
                  </div>
                )
                return (
                  // NOT: Burada önceden `onClick={() => setAcik(false)}` vardı — aynı tıklama
                  // olayında hem içteki modal `acik=true` yapıyor hem bu dış div `acik=false`
                  // yapıp paneli unmount ediyordu, modal render olmadan siliniyordu (hiçbir
                  // bildirim tıklanınca açılmıyordu). Artık panel'i sadece "dışarı tıkla"
                  // mekanizması (aşağıdaki disaTikla efekti) kapatıyor.
                  <div key={`${b.tur}-${b.id}`} className="border-b border-border last:border-0">
                    {b.tur === 'borc_yaklasan' || b.tur === 'borc_gecikti' ? (
                      <BorcDetayModal debtId={b.id} tetikleyici={satir} />
                    ) : b.tur === 'duzenli_yaklasan' ? (
                      <DuzenliIslemlerModal tetikleyiciOzel={satir} />
                    ) : b.tur === 'alacak_yaklasan' || b.tur === 'alacak_gecikti' ? (
                      receivableMap[b.id] ? <ReceivableDetayModal receivable={receivableMap[b.id]} tetikleyici={satir} /> : satir
                    ) : (
                      // butce_asildi: ayrı bir detay modali yok, Gelir-Gider'e yönlendir
                      <a href="/dashboard/gelir-gider" onClick={() => setAcik(false)}>{satir}</a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
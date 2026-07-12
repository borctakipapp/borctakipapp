'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import BorcDetayModal from '@/components/BorcDetayModal'
import DuzenliIslemlerModal from '@/components/DuzenliIslemlerModal'

type Bildirim = {
  tur: 'borc' | 'duzenli'
  id: string
  baslik: string
  altBaslik: string
  tutar: number
  gunKaldi: number
}

function sonrakiTarihHesapla(gun: number): Date {
  const bugun = new Date()
  const buAySonGun = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0).getDate()
  const buAyGun = Math.min(gun, buAySonGun)
  let hedef = new Date(bugun.getFullYear(), bugun.getMonth(), buAyGun)
  hedef.setHours(0, 0, 0, 0)
  const bugunSifirli = new Date(bugun)
  bugunSifirli.setHours(0, 0, 0, 0)

  if (hedef < bugunSifirli) {
    const gelecekAyYil = bugun.getMonth() === 11 ? bugun.getFullYear() + 1 : bugun.getFullYear()
    const gelecekAyAy = bugun.getMonth() === 11 ? 0 : bugun.getMonth() + 1
    const gelecekAySonGun = new Date(gelecekAyYil, gelecekAyAy + 1, 0).getDate()
    const gelecekAyGun = Math.min(gun, gelecekAySonGun)
    hedef = new Date(gelecekAyYil, gelecekAyAy, gelecekAyGun)
  }
  return hedef
}

export default function BildirimZili() {
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([])
  const [kullaniciId, setKullaniciId] = useState('')
  const kutuRef = useRef<HTMLDivElement>(null)

  const fetchBildirimler = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setYukleniyor(false); return }
    setKullaniciId(user.id)

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)

    // Borçlar
    const { data: debts } = await supabase
      .from('debts')
      .select('id, institution_name, remaining_amount, due_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('due_date', 'is', null)

    const borcListesi: Bildirim[] = (debts || [])
      .map((d) => {
        const [y, m, gun] = d.due_date.split('-').map(Number)
        const tarih = new Date(y, m - 1, gun)
        const gunKaldi = Math.round((tarih.getTime() - bugun.getTime()) / 86400000)
        return { tur: 'borc' as const, id: d.id, baslik: d.institution_name, altBaslik: '', tutar: Number(d.remaining_amount), gunKaldi }
      })
      .filter((d) => d.gunKaldi <= 5)

    // Düzenli işlemler (faturalar/giderler) — yaklaşan tekrar tarihini kendimiz hesaplıyoruz
    const { data: duzenliler } = await supabase
      .from('recurring_items')
      .select('id, category, description, amount, day_of_month')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('active', true)

    const duzenliListesi: Bildirim[] = (duzenliler || [])
      .map((r) => {
        const tarih = sonrakiTarihHesapla(r.day_of_month)
        const gunKaldi = Math.round((tarih.getTime() - bugun.getTime()) / 86400000)
        return { tur: 'duzenli' as const, id: r.id, baslik: r.category, altBaslik: r.description || '', tutar: Number(r.amount), gunKaldi }
      })
      .filter((d) => d.gunKaldi <= 5)

    const hepsi = [...borcListesi, ...duzenliListesi].sort((a, b) => a.gunKaldi - b.gunKaldi)
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
      .channel(`bildirimler-${kullaniciId}`)
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

  function gunEtiketi(gunKaldi: number) {
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
                const etiket = gunEtiketi(b.gunKaldi)
                const satir = (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper transition-colors cursor-pointer">
                    <Monogram isim={b.baslik} boyut={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy font-medium truncate">
                        {b.baslik} {b.tur === 'duzenli' && <span className="text-[10px] text-muted">↻</span>}
                      </p>
                      <p className={`text-[11px] ${etiket.renk}`}>{etiket.metin}</p>
                    </div>
                    <span className="font-mono text-xs text-navy shrink-0">
                      {b.tutar.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                )
                return (
                  <div key={`${b.tur}-${b.id}`} onClick={() => setAcik(false)} className="border-b border-border last:border-0">
                    {b.tur === 'borc' ? (
                      <BorcDetayModal debtId={b.id} tetikleyici={satir} />
                    ) : (
                      <DuzenliIslemlerModal tetikleyiciOzel={satir} />
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

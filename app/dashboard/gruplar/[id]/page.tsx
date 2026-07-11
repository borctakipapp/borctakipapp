'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import OnayModal from '@/components/OnayModal'
import { bakiyeHesapla, mutabakatOner } from '@/lib/grup-hesap'

type Uye = { user_id: string; ad_soyad: string | null; iban: string | null }
type Harcama = { id: string; odeyen_id: string; aciklama: string; tutar: number; tarih: string }

export default function GrupDetayPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const grupId = params.id as string

  const [loading, setLoading] = useState(true)
  const [grupAdi, setGrupAdi] = useState('')
  const [davetKodu, setDavetKodu] = useState('')
  const [uyeler, setUyeler] = useState<Uye[]>([])
  const [harcamalar, setHarcamalar] = useState<Harcama[]>([])
  const [bolusumler, setBolusumler] = useState<{ user_id: string; pay_tutari: number; harcama_id: string }[]>([])
  const [odemeler, setOdemeler] = useState<{ odeyen_id: string; alan_id: string; tutar: number }[]>([])
  const [kopyalandi, setKopyalandi] = useState(false)
  const [mevcutKullaniciId, setMevcutKullaniciId] = useState('')

  const [onayAcik, setOnayAcik] = useState(false)
  const [mutabakatSecili, setMutabakatSecili] = useState<{ borcluId: string; alacakliId: string; tutar: number } | null>(null)

  const [ibanDuzenleAcik, setIbanDuzenleAcik] = useState(false)
  const [ibanGirisi, setIbanGirisi] = useState('')
  const [ibanKaydediliyor, setIbanKaydediliyor] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setMevcutKullaniciId(user.id)

    const { data: grup } = await supabase.from('gruplar').select('*').eq('id', grupId).single()
    if (grup) { setGrupAdi(grup.ad); setDavetKodu(grup.davet_kodu) }

    const { data: uyeVerisi } = await supabase.from('grup_uyeler').select('user_id, ad_soyad, iban').eq('grup_id', grupId)
    setUyeler(uyeVerisi || [])
    const benimKaydim = (uyeVerisi || []).find((u) => u.user_id === user.id)
    if (benimKaydim) setIbanGirisi(benimKaydim.iban || '')

    const { data: harcamaVerisi } = await supabase
      .from('grup_harcamalar').select('*').eq('grup_id', grupId).order('tarih', { ascending: false })
    setHarcamalar(harcamaVerisi || [])

    const harcamaIds = (harcamaVerisi || []).map((h) => h.id)
    if (harcamaIds.length > 0) {
      const { data: bolusumVerisi } = await supabase
        .from('grup_harcama_bolusumu').select('*').in('harcama_id', harcamaIds)
      setBolusumler(bolusumVerisi || [])
    } else {
      setBolusumler([])
    }

    const { data: odemeVerisi } = await supabase.from('grup_odemeler').select('*').eq('grup_id', grupId)
    setOdemeler(odemeVerisi || [])

    setLoading(false)
  }, [grupId])

  useEffect(() => { fetchData() }, [fetchData])

  async function ibanKaydet() {
    setIbanKaydediliyor(true)
    await supabase.from('grup_uyeler').update({ iban: ibanGirisi || null }).eq('grup_id', grupId).eq('user_id', mevcutKullaniciId)
    setIbanKaydediliyor(false)
    setIbanDuzenleAcik(false)
    fetchData()
  }

  function davetLinkiKopyala() {
    const link = `${window.location.origin}/davet/${davetKodu}`
    navigator.clipboard.writeText(link)
    setKopyalandi(true)
    setTimeout(() => setKopyalandi(false), 2000)
  }

  function mutabakatTikla(oneri: { borcluId: string; alacakliId: string; tutar: number }) {
    setMutabakatSecili(oneri)
    setOnayAcik(true)
  }

  async function gercekMutabakatKaydet() {
    if (!mutabakatSecili) return
    setOnayAcik(false)
    await supabase.from('grup_odemeler').insert({
      grup_id: grupId,
      odeyen_id: mutabakatSecili.borcluId,
      alan_id: mutabakatSecili.alacakliId,
      tutar: mutabakatSecili.tutar,
    })
    fetchData()
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  const bakiyeler = bakiyeHesapla(harcamalar, bolusumler, odemeler, uyeler)
  const oneriler = mutabakatOner(bakiyeler)
  const benimBakiyem = bakiyeler.find((b) => b.userId === mevcutKullaniciId)

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 flex items-center">
        <button onClick={() => router.push('/dashboard/gruplar')} className="text-paper/70 hover:text-paper text-sm">
          ← Gruplara dön
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Monogram isim={grupAdi} boyut={44} />
          <h1 className="text-xl font-medium text-navy">{grupAdi}</h1>
        </div>
        <p className="text-xs text-muted mb-6">{uyeler.length} üye</p>

        {benimBakiyem && (
          <div className={`rounded-lg p-4 border mb-4 ${benimBakiyem.net >= 0 ? 'bg-sage-soft border-sage' : 'bg-brick-soft border-brick'}`}>
            <p className="text-xs text-muted mb-1">Senin durumun</p>
            <p className={`font-mono text-2xl font-medium ${benimBakiyem.net >= 0 ? 'text-sage' : 'text-brick'}`}>
              {benimBakiyem.net >= 0 ? '+' : ''}{benimBakiyem.net.toLocaleString('tr-TR')} ₺
            </p>
            <p className="text-xs text-muted mt-1">
              {benimBakiyem.net > 0.5 && 'Sana borçlu olanlar var'}
              {benimBakiyem.net < -0.5 && 'Sen borçlusun'}
              {Math.abs(benimBakiyem.net) <= 0.5 && 'Hesabın kapalı, kimseye borcun yok'}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <Link href={`/dashboard/gruplar/${grupId}/harcama-ekle`} className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 text-center hover:bg-navy-light transition-colors">
            + Harcama Ekle
          </Link>
          <Link href={`/dashboard/gruplar/${grupId}/sohbet`} className="flex-1 bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 text-center hover:bg-paper transition-colors">
            💬 Sohbet
          </Link>
        </div>
        <button onClick={davetLinkiKopyala} className="w-full bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 mb-6 hover:bg-paper transition-colors">
          {kopyalandi ? '✓ Kopyalandı' : '🔗 Davet Linkini Kopyala'}
        </button>

        <h2 className="text-sm font-medium text-muted mb-3">Kim Kime Ne Kadar Borçlu</h2>
        {oneriler.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border mb-8">Herkesin hesabı kapalı — kimse kimseye borçlu değil. 🎉</p>
        ) : (
          <div className="flex flex-col gap-2 mb-8">
            {oneriler.map((o, i) => {
              const alacakliIban = uyeler.find((u) => u.user_id === o.alacakliId)?.iban
              return (
                <div key={i} className="bg-white rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-navy flex-1">
                      <b>{o.borcluAd}</b> → <b>{o.alacakliAd}</b>
                    </p>
                    <span className="font-mono text-navy text-sm">{o.tutar.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  {o.borcluId === mevcutKullaniciId && alacakliIban && (
                    <p className="text-[11px] text-muted font-mono mt-1">Gönderilecek IBAN: {alacakliIban}</p>
                  )}
                  {(o.borcluId === mevcutKullaniciId || o.alacakliId === mevcutKullaniciId) && (
                    <button
                      onClick={() => mutabakatTikla(o)}
                      className="text-xs text-sage underline mt-2"
                    >
                      Ödendi İşaretle
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">Üyeler</h2>
          <button onClick={() => setIbanDuzenleAcik((a) => !a)} className="text-xs text-navy underline">
            IBAN'ımı Düzenle
          </button>
        </div>

        {ibanDuzenleAcik && (
          <div className="bg-white rounded-lg p-4 border border-border mb-3 flex flex-col gap-2">
            <label className="text-xs text-muted">Ödeme almak için IBAN'ın (diğer üyeler görebilir)</label>
            <input
              type="text" value={ibanGirisi} onChange={(e) => setIbanGirisi(e.target.value)}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
            />
            <button onClick={ibanKaydet} disabled={ibanKaydediliyor}
              className="bg-navy text-paper text-xs font-medium rounded-lg py-2 hover:bg-navy-light transition-colors disabled:opacity-60">
              {ibanKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-8">
          {uyeler.map((u) => {
            const b = bakiyeler.find((bk) => bk.userId === u.user_id)
            return (
              <div key={u.user_id} className="bg-white rounded-lg p-3 border border-border flex items-center gap-3">
                <Monogram isim={u.ad_soyad || '?'} boyut={30} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate">{u.ad_soyad}</p>
                  {u.iban && <p className="text-[11px] text-muted font-mono truncate">{u.iban}</p>}
                </div>
                {b && (
                  <span className={`font-mono text-xs ${b.net >= 0 ? 'text-sage' : 'text-brick'}`}>
                    {b.net >= 0 ? '+' : ''}{b.net.toLocaleString('tr-TR')} ₺
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <h2 className="text-sm font-medium text-muted mb-3">Harcamalar ({harcamalar.length})</h2>
        {harcamalar.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Henüz harcama eklenmedi.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {harcamalar.map((h) => {
              const odeyen = uyeler.find((u) => u.user_id === h.odeyen_id)
              return (
                <div key={h.id} className="bg-white rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-navy text-sm">{h.aciklama}</p>
                    <span className="font-mono text-navy text-sm">{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {odeyen?.ad_soyad || 'Bilinmeyen'} ödedi · {new Date(h.tarih).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <OnayModal
        acik={onayAcik}
        baslik="Mutabakatı kaydet"
        mesaj={mutabakatSecili ? `${mutabakatSecili.tutar.toLocaleString('tr-TR')} ₺ ödendi olarak işaretlensin mi? Bu, iki tarafın da hesabını günceller.` : ''}
        onayMetni="Evet, Ödendi"
        tehlikeli={false}
        onOnayla={gercekMutabakatKaydet}
        onVazgec={() => setOnayAcik(false)}
      />
    </div>
  )
}
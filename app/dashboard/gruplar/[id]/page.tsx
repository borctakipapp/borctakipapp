'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import OnayModal from '@/components/OnayModal'
import PastaGrafik from '@/components/PastaGrafik'
import SohbetModal from '@/components/SohbetModal'
import GrupHarcamaEkleModal from '@/components/GrupHarcamaEkleModal'
import { bakiyeHesapla, mutabakatOner } from '@/lib/grup-hesap'
import { ibanFormatla, ibanTemizle, ibanGecerliMi } from '@/lib/iban'

type Uye = { user_id: string; ad_soyad: string | null; iban: string | null }
type Harcama = { id: string; odeyen_id: string; aciklama: string; tutar: number; tarih: string }

const MONOGRAM_RENKLERI = ['#B5533C', '#4A7C74', '#D98E3F', '#5B7FA6', '#8B6BA8', '#6B8E4E', '#C77B8E', '#4A6670']
function kisiRengi(isim: string) {
  let hash = 0
  for (let i = 0; i < isim.length; i++) hash = isim.charCodeAt(i) + ((hash << 5) - hash)
  return MONOGRAM_RENKLERI[Math.abs(hash) % MONOGRAM_RENKLERI.length]
}

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
  const [ibanKopyalandi, setIbanKopyalandi] = useState<string | null>(null)
  const [mevcutKullaniciId, setMevcutKullaniciId] = useState('')
  const [acikKisi, setAcikKisi] = useState<string | null>(null)

  const [onayAcik, setOnayAcik] = useState(false)
  const [mutabakatSecili, setMutabakatSecili] = useState<{ borcluId: string; alacakliId: string; tutar: number } | null>(null)

  const [ibanDuzenleAcik, setIbanDuzenleAcik] = useState(false)
  const [ibanGirisi, setIbanGirisi] = useState('')
  const [ibanHata, setIbanHata] = useState('')
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
    if (benimKaydim) setIbanGirisi(benimKaydim.iban ? ibanFormatla(benimKaydim.iban) : '')

    const { data: harcamaVerisi } = await supabase
      .from('grup_harcamalar').select('*').eq('grup_id', grupId).order('tarih', { ascending: false })
    setHarcamalar(harcamaVerisi || [])

    const harcamaIds = (harcamaVerisi || []).map((h) => h.id)
    if (harcamaIds.length > 0) {
      const { data: bolusumVerisi } = await supabase.from('grup_harcama_bolusumu').select('*').in('harcama_id', harcamaIds)
      setBolusumler(bolusumVerisi || [])
    } else {
      setBolusumler([])
    }

    const { data: odemeVerisi } = await supabase.from('grup_odemeler').select('*').eq('grup_id', grupId)
    setOdemeler(odemeVerisi || [])

    setLoading(false)
  }, [grupId])

  useEffect(() => { fetchData() }, [fetchData])

  function davetLinkiKopyala() {
    navigator.clipboard.writeText(`${window.location.origin}/davet/${davetKodu}`)
    setKopyalandi(true)
    setTimeout(() => setKopyalandi(false), 2000)
  }

  function ibanKopyala(iban: string) {
    navigator.clipboard.writeText(ibanTemizle(iban))
    setIbanKopyalandi(iban)
    setTimeout(() => setIbanKopyalandi(null), 2000)
  }

  async function ibanKaydet() {
    const temiz = ibanTemizle(ibanGirisi)
    if (temiz && !ibanGecerliMi(temiz)) {
      setIbanHata('IBAN formatı geçersiz görünüyor. TR ile başlayıp 24 rakamla devam etmeli.')
      return
    }
    setIbanHata('')
    setIbanKaydediliyor(true)
    await supabase.from('grup_uyeler').update({ iban: temiz || null }).eq('grup_id', grupId).eq('user_id', mevcutKullaniciId)
    setIbanKaydediliyor(false)
    setIbanDuzenleAcik(false)
    fetchData()
  }

  function mutabakatTikla(oneri: { borcluId: string; alacakliId: string; tutar: number }) {
    setMutabakatSecili(oneri)
    setOnayAcik(true)
  }

  async function gercekMutabakatKaydet() {
    if (!mutabakatSecili) return
    setOnayAcik(false)
    await supabase.from('grup_odemeler').insert({
      grup_id: grupId, odeyen_id: mutabakatSecili.borcluId, alan_id: mutabakatSecili.alacakliId, tutar: mutabakatSecili.tutar,
    })
    fetchData()
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm">Yükleniyor...</div>
  }

  const bakiyeler = bakiyeHesapla(harcamalar, bolusumler, odemeler, uyeler)
  const oneriler = mutabakatOner(bakiyeler)
  const benimBakiyem = bakiyeler.find((b) => b.userId === mevcutKullaniciId)

  // Kim ne kadar harcadı (pasta grafik için)
  const harcamaDilimleri = uyeler
    .map((u) => ({
      ad: u.ad_soyad || 'Bilinmeyen',
      tutar: harcamalar.filter((h) => h.odeyen_id === u.user_id).reduce((s, h) => s + Number(h.tutar), 0),
      renk: kisiRengi(u.ad_soyad || u.user_id),
    }))
    .filter((d) => d.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar)

  return (
    <main className="max-w-md mx-auto px-6 py-10 pb-24 md:pb-10">
      <Link href="/dashboard/gruplar" className="text-xs text-muted hover:text-navy mb-4 inline-block">
        ← Gruplara dön
      </Link>
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
          <GrupHarcamaEkleModal grupId={grupId} />
          <SohbetModal grupId={grupId} grupAdi={grupAdi} />
        </div>
        <button onClick={davetLinkiKopyala} className="w-full bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 mb-6 hover:bg-paper transition-colors">
          {kopyalandi ? '✓ Kopyalandı' : '🔗 Davet Linkini Kopyala'}
        </button>

        {/* IBAN düzenleme */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">IBAN'ım</h2>
          <button onClick={() => setIbanDuzenleAcik((a) => !a)} className="text-xs text-navy underline">
            {ibanDuzenleAcik ? 'Vazgeç' : 'Düzenle'}
          </button>
        </div>
        {ibanDuzenleAcik && (
          <div className="bg-white rounded-lg p-4 border border-border mb-3 flex flex-col gap-2">
            <label className="text-xs text-muted">Ödeme almak için IBAN'ın (diğer üyeler görüp kopyalayabilir)</label>
            <input
              type="text" value={ibanGirisi}
              onChange={(e) => { setIbanGirisi(ibanFormatla(e.target.value)); setIbanHata('') }}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              maxLength={32}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono"
            />
            {ibanHata && <p className="text-xs text-brick">{ibanHata}</p>}
            <button onClick={ibanKaydet} disabled={ibanKaydediliyor}
              className="bg-navy text-paper text-xs font-medium rounded-lg py-2 hover:bg-navy-light transition-colors disabled:opacity-60">
              {ibanKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        {/* Pasta grafik — kim ne kadar harcadı */}
        {harcamaDilimleri.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted mb-3">Kim Ne Kadar Harcadı</h2>
            <div className="bg-white rounded-lg p-4 border border-border">
              <PastaGrafik dilimler={harcamaDilimleri} />
            </div>
          </div>
        )}

        {/* Kişi listesi — tıklayınca o kişinin borçları/alacakları açılır */}
        <h2 className="text-sm font-medium text-muted mb-3">Kim Kime Ne Kadar Borçlu</h2>
        <div className="flex flex-col gap-2 mb-8">
          {uyeler.map((u) => {
            const b = bakiyeler.find((bk) => bk.userId === u.user_id)
            const benimBorclarim = oneriler.filter((o) => o.borcluId === u.user_id)
            const banaBorclu = oneriler.filter((o) => o.alacakliId === u.user_id)
            const acik = acikKisi === u.user_id
            const hareketVar = benimBorclarim.length > 0 || banaBorclu.length > 0

            return (
              <div key={u.user_id} className="bg-white rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setAcikKisi(acik ? null : u.user_id)}
                  disabled={!hareketVar}
                  className="w-full p-3 flex items-center gap-3 text-left disabled:cursor-default"
                >
                  <Monogram isim={u.ad_soyad || '?'} boyut={30} />
                  <p className="text-sm text-navy flex-1 truncate">{u.ad_soyad}</p>
                  {b && Math.abs(b.net) > 0.5 && (
                    <span className={`font-mono text-xs ${b.net >= 0 ? 'text-sage' : 'text-brick'}`}>
                      {b.net >= 0 ? '+' : ''}{b.net.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                  {b && Math.abs(b.net) <= 0.5 && <span className="text-xs text-muted">Kapalı</span>}
                  {hareketVar && <span className="text-muted text-xs">{acik ? '▲' : '▼'}</span>}
                </button>

                {acik && hareketVar && (
                  <div className="border-t border-border px-3 py-3 flex flex-col gap-2 bg-paper/50">
                    {benimBorclarim.map((o, i) => {
                      const alacakli = uyeler.find((uu) => uu.user_id === o.alacakliId)
                      return (
                        <div key={`b-${i}`} className="bg-white rounded-lg p-3 border border-brick/30">
                          <p className="text-xs text-navy">
                            <b>{o.borcluAd}</b> → <b>{o.alacakliAd}</b>'a <span className="font-mono">{o.tutar.toLocaleString('tr-TR')} ₺</span> ödemeli
                          </p>
                          {alacakli?.iban && (
                            <button
                              onClick={() => ibanKopyala(alacakli.iban!)}
                              className="text-[11px] text-muted font-mono mt-1.5 flex items-center gap-1.5 hover:text-navy transition-colors"
                            >
                              📋 {ibanFormatla(alacakli.iban)} {ibanKopyalandi === alacakli.iban ? '· Kopyalandı ✓' : '· kopyala'}
                            </button>
                          )}
                          {(o.borcluId === mevcutKullaniciId || o.alacakliId === mevcutKullaniciId) && (
                            <button onClick={() => mutabakatTikla(o)} className="text-xs text-sage underline mt-2 block">
                              Ödendi İşaretle
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {banaBorclu.map((o, i) => (
                      <div key={`a-${i}`} className="bg-white rounded-lg p-3 border border-sage/30">
                        <p className="text-xs text-navy">
                          <b>{o.borcluAd}</b>, <b>{o.alacakliAd}</b>'dan <span className="font-mono">{o.tutar.toLocaleString('tr-TR')} ₺</span> alacaklı
                        </p>
                      </div>
                    ))}
                  </div>
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
    </main>
  )
}

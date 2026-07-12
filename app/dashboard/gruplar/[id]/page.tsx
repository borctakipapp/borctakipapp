'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Monogram from '@/components/Monogram'
import OnayModal from '@/components/OnayModal'
import Modal from '@/components/Modal'
import PastaGrafik from '@/components/PastaGrafik'
import SohbetModal from '@/components/SohbetModal'
import GrupHarcamaEkleModal from '@/components/GrupHarcamaEkleModal'
import GrupHarcamaDuzenleModal from '@/components/GrupHarcamaDuzenleModal'
import { bakiyeHesapla, mutabakatOner } from '@/lib/grup-hesap'
import { ibanFormatla, ibanTemizle, ibanGecerliMi } from '@/lib/iban'
import { useToast } from '@/components/Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import Skeleton from '@/components/Skeleton'

type Uye = { user_id: string; ad_soyad: string | null; iban: string | null }
type Harcama = { id: string; odeyen_id: string; aciklama: string; tutar: number; tarih: string }
type Sekme = 'genel' | 'uyeler' | 'harcamalar'

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
  const [sekme, setSekme] = useState<Sekme>('genel')
  const [grupAdi, setGrupAdi] = useState('')
  const [davetKodu, setDavetKodu] = useState('')
  const [olusturanId, setOlusturanId] = useState('')
  const [onaySilGrupAcik, setOnaySilGrupAcik] = useState(false)
  const [silingGrup, setSilinGrup] = useState(false)
  const { goster } = useToast()
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
    if (grup) { setGrupAdi(grup.ad); setDavetKodu(grup.davet_kodu); setOlusturanId(grup.olusturan_id) }

    const { data: uyeVerisi } = await supabase.from('grup_uyeler').select('user_id, ad_soyad, iban').eq('grup_id', grupId)
    let guncelUyeler = uyeVerisi || []
    const benimKaydim = guncelUyeler.find((u) => u.user_id === user.id)
    if (benimKaydim) setIbanGirisi(benimKaydim.iban ? ibanFormatla(benimKaydim.iban) : '')

    // Geriye dönük düzeltme: kendi görünen adım hâlâ e-posta ise ve profilimde ad-soyad varsa, otomatik güncelle
    if (benimKaydim && benimKaydim.ad_soyad === user.email) {
      const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profil?.full_name?.trim()) {
        await supabase.from('grup_uyeler').update({ ad_soyad: profil.full_name.trim() }).eq('grup_id', grupId).eq('user_id', user.id)
        guncelUyeler = guncelUyeler.map((u) => (u.user_id === user.id ? { ...u, ad_soyad: profil.full_name!.trim() } : u))
      }
    }
    setUyeler(guncelUyeler)

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

  // Canlı güncelleme: bu grupla ilgili herhangi bir tabloda (harcama, üye, ödeme, bölüşüm)
  // değişiklik olunca — başka bir sekmeden/kullanıcıdan gelse bile — sayfa otomatik yenilenir.
  useEffect(() => {
    const kanal = supabase
      .channel(`grup-canli-${grupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grup_harcamalar', filter: `grup_id=eq.${grupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grup_uyeler', filter: `grup_id=eq.${grupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grup_odemeler', filter: `grup_id=eq.${grupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grup_harcama_bolusumu' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(kanal) }
  }, [grupId, fetchData])

  async function gercekGrubuSil() {
    setOnaySilGrupAcik(false)
    setSilinGrup(true)
    const { error } = await supabase.from('gruplar').delete().eq('id', grupId)
    if (error) {
      goster(hataMesajiCevir(error), 'hata')
      setSilinGrup(false)
    } else {
      goster('Grup silindi.')
      router.push('/dashboard/gruplar')
      router.refresh()
    }
  }

  function davetLinkiKopyala() {
    navigator.clipboard.writeText(`${window.location.origin}/davet/${davetKodu}`)
    setKopyalandi(true)
    goster('Davet linki kopyalandı.')
    setTimeout(() => setKopyalandi(false), 2000)
  }

  function ibanKopyala(iban: string) {
    navigator.clipboard.writeText(ibanTemizle(iban))
    setIbanKopyalandi(iban)
    goster('IBAN kopyalandı.')
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
    const { error } = await supabase.from('grup_uyeler').update({ iban: temiz || null }).eq('grup_id', grupId).eq('user_id', mevcutKullaniciId)
    setIbanKaydediliyor(false)
    setIbanDuzenleAcik(false)
    if (error) goster(hataMesajiCevir(error), 'hata')
    else goster('IBAN kaydedildi.')
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
    goster('Mutabakat kaydedildi.')
    fetchData()
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-border animate-pulse" />
          <div className="h-4 bg-border rounded w-32 animate-pulse" />
        </div>
        <Skeleton satirlar={5} />
      </main>
    )
  }

  const bakiyeler = bakiyeHesapla(harcamalar, bolusumler, odemeler, uyeler)
  const oneriler = mutabakatOner(bakiyeler)
  const benimBakiyem = bakiyeler.find((b) => b.userId === mevcutKullaniciId)

  const harcamaDilimleri = uyeler
    .map((u) => ({
      ad: u.ad_soyad || 'Bilinmeyen',
      tutar: harcamalar.filter((h) => h.odeyen_id === u.user_id).reduce((s, h) => s + Number(h.tutar), 0),
      renk: kisiRengi(u.ad_soyad || u.user_id),
    }))
    .filter((d) => d.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar)

  const SEKMELER: { key: Sekme; etiket: string }[] = [
    { key: 'genel', etiket: 'Genel Bakış' },
    { key: 'uyeler', etiket: 'Üyeler' },
    { key: 'harcamalar', etiket: `Harcamalar (${harcamalar.length})` },
  ]

  return (
    <>
    <main className="max-w-md mx-auto px-6 py-8 pb-24 md:pb-10">
      <Link href="/dashboard/gruplar" className="text-xs text-muted hover:text-navy mb-4 inline-block">
        ← Gruplara dön
      </Link>

      {/* Hero — her sekmede sabit, kompakt */}
      <div className="flex items-center gap-3 mb-1">
        <Monogram isim={grupAdi} boyut={40} />
        <div>
          <h1 className="text-lg font-medium text-navy leading-tight">{grupAdi}</h1>
          <p className="text-xs text-muted">{uyeler.length} üye</p>
        </div>
      </div>

      {benimBakiyem && (
        <div className={`rounded-lg p-3 border mt-3 mb-3 flex items-center justify-between ${benimBakiyem.net >= 0 ? 'bg-sage-soft border-sage' : 'bg-brick-soft border-brick'}`}>
          <div>
            <p className="text-[11px] text-muted">Senin durumun</p>
            <p className="text-[11px] text-muted">
              {benimBakiyem.net > 0.5 && 'Sana borçlu olanlar var'}
              {benimBakiyem.net < -0.5 && 'Sen borçlusun'}
              {Math.abs(benimBakiyem.net) <= 0.5 && 'Hesabın kapalı'}
            </p>
          </div>
          <p className={`font-mono text-xl font-medium ${benimBakiyem.net >= 0 ? 'text-sage' : 'text-brick'}`}>
            {benimBakiyem.net >= 0 ? '+' : ''}{benimBakiyem.net.toLocaleString('tr-TR')} ₺
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <GrupHarcamaEkleModal grupId={grupId} onBasarili={fetchData} />
        <SohbetModal grupId={grupId} grupAdi={grupAdi} />
      </div>
      <button onClick={davetLinkiKopyala} className="w-full bg-white border border-border text-navy text-xs font-medium rounded-lg py-2 mb-5 hover:bg-paper transition-colors">
        {kopyalandi ? '✓ Kopyalandı' : '🔗 Davet Linkini Kopyala'}
      </button>

      {/* Sekme geçişi — sayfa dikey uzamasın diye tek seferde tek bölüm gösteriliyor */}
      <div className="flex gap-1 bg-white border border-border rounded-lg p-1 mb-5">
        {SEKMELER.map((s) => (
          <button
            key={s.key}
            onClick={() => setSekme(s.key)}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
              sekme === s.key ? 'bg-navy text-paper' : 'text-muted hover:bg-paper'
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {/* --- SEKME: GENEL BAKIŞ --- */}
      {sekme === 'genel' && (
        <>
          {harcamaDilimleri.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted mb-3">Kim Ne Kadar Harcadı</h2>
              <div className="bg-white rounded-lg p-4 border border-border">
                <PastaGrafik dilimler={harcamaDilimleri} />
              </div>
            </div>
          )}

          <h2 className="text-sm font-medium text-muted mb-3">Kim Kime Ne Kadar Borçlu</h2>
          {oneriler.length === 0 ? (
            <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Herkesin hesabı kapalı — kimse kimseye borçlu değil. 🎉</p>
          ) : (
            <div className="flex flex-col gap-2">
              {uyeler.map((u) => {
                const b = bakiyeler.find((bk) => bk.userId === u.user_id)
                const hareketVar = oneriler.some((o) => o.borcluId === u.user_id || o.alacakliId === u.user_id)
                if (!hareketVar) return null

                return (
                  <button
                    key={u.user_id}
                    onClick={() => setAcikKisi(u.user_id)}
                    className="w-full bg-white rounded-lg border border-border p-3 flex items-center gap-3 text-left hover:shadow-sm transition-shadow"
                  >
                    <Monogram isim={u.ad_soyad || '?'} boyut={30} />
                    <p className="text-sm text-navy flex-1 truncate">{u.ad_soyad}</p>
                    {b && Math.abs(b.net) > 0.5 && (
                      <span className={`font-mono text-xs ${b.net >= 0 ? 'text-sage' : 'text-brick'}`}>
                        {b.net >= 0 ? '+' : ''}{b.net.toLocaleString('tr-TR')} ₺
                      </span>
                    )}
                    <span className="text-muted text-xs">›</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Kişi detay modalı — tek paylaşılan modal, seçili kişiye göre içerik gösteriyor.
              İçerik `oneriler`'den (canlı state'ten) türediği için Realtime ile otomatik güncel kalır. */}
          {(() => {
            const seciliKisi = uyeler.find((u) => u.user_id === acikKisi)
            const benimBorclarimSecili = acikKisi ? oneriler.filter((o) => o.borcluId === acikKisi) : []
            const banaBorcluSecili = acikKisi ? oneriler.filter((o) => o.alacakliId === acikKisi) : []
            return (
              <Modal acik={!!seciliKisi} baslik={seciliKisi?.ad_soyad || ''} onKapat={() => setAcikKisi(null)}>
                {benimBorclarimSecili.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Borçlu Olduğu Kişiler</h3>
                    <div className="flex flex-col gap-2">
                      {benimBorclarimSecili.map((o, i) => {
                        const alacakli = uyeler.find((uu) => uu.user_id === o.alacakliId)
                        return (
                          <div key={`b-${i}`} className="bg-white rounded-lg p-3 border border-brick/30">
                            <p className="text-xs text-navy">
                              <b>{o.borcluAd}</b> → <b>{o.alacakliAd}</b>'a <span className="font-mono">{o.tutar.toLocaleString('tr-TR')} ₺</span> ödemeli
                            </p>
                            {alacakli?.iban ? (
                              <button
                                onClick={() => ibanKopyala(alacakli.iban!)}
                                className="text-[11px] text-navy font-mono mt-1.5 flex items-center gap-1.5 hover:text-sage transition-colors"
                              >
                                📋 {ibanFormatla(alacakli.iban)} {ibanKopyalandi === alacakli.iban ? '· Kopyalandı ✓' : '· kopyala'}
                              </button>
                            ) : (
                              <p className="text-[11px] text-muted mt-1.5">Bu kişi henüz IBAN eklemedi.</p>
                            )}
                            {(o.borcluId === mevcutKullaniciId || o.alacakliId === mevcutKullaniciId) && (
                              <button onClick={() => mutabakatTikla(o)} className="text-xs text-sage underline mt-2 block">
                                Ödendi İşaretle
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {banaBorcluSecili.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Alacaklı Olduğu Kişiler</h3>
                    <div className="flex flex-col gap-2">
                      {banaBorcluSecili.map((o, i) => (
                        <div key={`a-${i}`} className="bg-white rounded-lg p-3 border border-sage/30">
                          <p className="text-xs text-navy">
                            <b>{o.alacakliAd}</b>, <b>{o.borcluAd}</b>'dan <span className="font-mono">{o.tutar.toLocaleString('tr-TR')} ₺</span> alacaklı
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Modal>
            )
          })()}
        </>
      )}

      {/* --- SEKME: ÜYELER (IBAN burada, göze çarpan şekilde) --- */}
      {sekme === 'uyeler' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-muted">IBAN'ım</h2>
            <button onClick={() => setIbanDuzenleAcik((a) => !a)} className="text-xs text-navy underline">
              {ibanDuzenleAcik ? 'Vazgeç' : ibanGirisi ? 'Düzenle' : '+ Ekle'}
            </button>
          </div>
          {ibanDuzenleAcik && (
            <div className="bg-white rounded-lg p-4 border border-border mb-5 flex flex-col gap-2">
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

          <h2 className="text-sm font-medium text-muted mb-3">Tüm Üyeler</h2>
          <div className="flex flex-col gap-2 mb-6">
            {uyeler.map((u) => {
              const b = bakiyeler.find((bk) => bk.userId === u.user_id)
              const benimMi = u.user_id === mevcutKullaniciId
              return (
                <div key={u.user_id} className="bg-white rounded-lg p-3 border border-border flex items-center gap-3">
                  <Monogram isim={u.ad_soyad || '?'} boyut={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy font-medium truncate">
                      {u.ad_soyad}{benimMi && <span className="text-muted font-normal"> (Sen)</span>}
                    </p>
                    {u.iban ? (
                      <button
                        onClick={() => ibanKopyala(u.iban!)}
                        className="text-xs font-mono text-navy hover:text-sage transition-colors flex items-center gap-1 mt-0.5"
                      >
                        📋 {ibanFormatla(u.iban)}
                        {ibanKopyalandi === u.iban && <span className="text-sage">· Kopyalandı</span>}
                      </button>
                    ) : (
                      <p className="text-xs text-muted mt-0.5">
                        {benimMi ? 'IBAN eklemedin — yukarıdan ekleyebilirsin' : 'IBAN eklenmemiş'}
                      </p>
                    )}
                  </div>
                  {b && Math.abs(b.net) > 0.5 && (
                    <span className={`font-mono text-xs shrink-0 ${b.net >= 0 ? 'text-sage' : 'text-brick'}`}>
                      {b.net >= 0 ? '+' : ''}{b.net.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {mevcutKullaniciId && olusturanId && mevcutKullaniciId === olusturanId && (
            <details>
              <summary className="text-xs text-muted cursor-pointer">Grup ayarları</summary>
              <button
                onClick={() => setOnaySilGrupAcik(true)}
                disabled={silingGrup}
                className="w-full mt-2 bg-brick-soft text-brick text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity disabled:opacity-60"
              >
                {silingGrup ? 'Siliniyor...' : 'Grubu Sil'}
              </button>
              <p className="text-[11px] text-muted mt-1.5">
                Bu, grubu ve içindeki tüm harcama/mesaj geçmişini kalıcı olarak siler. Sadece grubu oluşturan kişi (sen) silebilir.
              </p>
            </details>
          )}
        </>
      )}

      {/* --- SEKME: HARCAMALAR --- */}
      {sekme === 'harcamalar' && (
        harcamalar.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">Henüz harcama eklenmedi.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {harcamalar.map((h) => {
              const odeyen = uyeler.find((u) => u.user_id === h.odeyen_id)
              const katilanSayisi = bolusumler.filter((b) => b.harcama_id === h.id).length
              return (
                <GrupHarcamaDuzenleModal
                  key={h.id}
                  harcama={h}
                  katilanSayisi={katilanSayisi || uyeler.length}
                  tetikleyici={
                    <div className="bg-white rounded-lg p-4 border border-border cursor-pointer hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-navy text-sm">{h.aciklama}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-navy text-sm">{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                          <span className="text-muted text-xs">✎</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {odeyen?.ad_soyad || 'Bilinmeyen'} ödedi · {new Date(h.tarih).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  }
                />
              )
            })}
          </div>
        )
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

    <OnayModal
      acik={onaySilGrupAcik}
      baslik="Grubu sil"
      mesaj={`"${grupAdi}" grubunu ve içindeki tüm harcama/mesaj geçmişini kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.`}
      onOnayla={gercekGrubuSil}
      onVazgec={() => setOnaySilGrupAcik(false)}
    />
    </>
  )
}
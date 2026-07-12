'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import OnayModal from './OnayModal'
import Skeleton from './Skeleton'
import Monogram from './Monogram'
import { useToast } from './Toast'
import { davetGonder, davetiOnayla, baglantiyiSil } from '@/lib/aile-actions'

type Baglanti = {
  id: string
  davet_eden_id: string
  davet_edilen_id: string
  davet_edilen_email: string
  durum: string
}

export default function AileButcesiModal() {
  const supabase = createClient()
  const { goster } = useToast()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mevcutKullaniciId, setMevcutKullaniciId] = useState('')
  const [baglanti, setBaglanti] = useState<Baglanti | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [message, setMessage] = useState('')
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  const [benimOzet, setBenimOzet] = useState<{ borc: number; net: number; birikim: number } | null>(null)
  const [partnerOzet, setPartnerOzet] = useState<{ toplam_borc: number; bu_ay_net: number; toplam_birikim: number } | null>(null)
  const [partnerAdi, setPartnerAdi] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMevcutKullaniciId(user.id)

    const { data: baglantilar } = await supabase
      .from('aile_baglantilari')
      .select('*')
      .or(`davet_eden_id.eq.${user.id},davet_edilen_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)

    const buBaglanti = baglantilar?.[0] || null
    setBaglanti(buBaglanti)

    if (buBaglanti && buBaglanti.durum === 'onaylandi') {
      const partnerId = buBaglanti.davet_eden_id === user.id ? buBaglanti.davet_edilen_id : buBaglanti.davet_eden_id

      // Kendi özetim
      const { data: debts } = await supabase.from('debts').select('remaining_amount').eq('user_id', user.id).eq('status', 'active')
      const toplamBorc = (debts || []).reduce((s, d) => s + Number(d.remaining_amount), 0)

      const baslangicAy = new Date(); baslangicAy.setDate(1)
      const { data: tx } = await supabase.from('transactions').select('type, amount').eq('user_id', user.id).gte('transaction_date', baslangicAy.toISOString().slice(0, 10))
      const net = (tx || []).reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)

      const { data: hedefler } = await supabase.from('savings_goals').select('current_amount').eq('user_id', user.id)
      const toplamBirikim = (hedefler || []).reduce((s, h) => s + Number(h.current_amount), 0)

      setBenimOzet({ borc: toplamBorc, net, birikim: toplamBirikim })
      setPartnerAdi(buBaglanti.davet_eden_id === user.id ? buBaglanti.davet_edilen_email : '')

      // Partnerin özeti — güvenli RPC üzerinden
      const { data: partnerVeri, error: partnerHata } = await supabase.rpc('partner_ozet_getir', { _partner_id: partnerId })
      if (!partnerHata && partnerVeri && partnerVeri[0]) {
        setPartnerOzet(partnerVeri[0])
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { if (acik) fetchData() }, [acik, fetchData])

  // Canlı güncelleme: partnerin daveti onaylaması/reddetmesi modal açıkken anında yansısın
  useEffect(() => {
    if (!acik || !mevcutKullaniciId) return
    const kanal = supabase
      .channel(`aile-baglanti-${mevcutKullaniciId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aile_baglantilari' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(kanal) }
  }, [acik, mevcutKullaniciId, fetchData])

  async function handleDavetGonder(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!partnerEmail.trim()) { setMessage('Bir e-posta gir.'); return }
    setGonderiliyor(true)
    const sonuc = await davetGonder(partnerEmail)
    setGonderiliyor(false)
    if (sonuc.hata) { setMessage(sonuc.hata) }
    else { goster('Davet gönderildi.'); setPartnerEmail(''); fetchData() }
  }

  async function handleOnayla() {
    if (!baglanti) return
    const sonuc = await davetiOnayla(baglanti.id)
    if (sonuc.hata) goster(sonuc.hata, 'hata')
    else { goster('Bağlantı onaylandı.'); fetchData() }
  }

  async function gercekBaglantiyiSil() {
    if (!baglanti) return
    setOnaySilAcik(false)
    const sonuc = await baglantiyiSil(baglanti.id)
    if (sonuc.hata) goster(sonuc.hata, 'hata')
    else { goster('Bağlantı kaldırıldı.'); setBaglanti(null); setPartnerOzet(null); fetchData() }
  }

  const benBekleyenTaraf = baglanti && baglanti.durum === 'bekliyor' && baglanti.davet_edilen_id === mevcutKullaniciId

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="w-full bg-white rounded-lg border border-border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow text-left"
      >
        <span className="text-xl">👨‍👩‍👧</span>
        <div>
          <p className="text-sm font-medium text-navy">Aile Bütçesi</p>
          <p className="text-xs text-muted">Partnerinle özet finansal durumu karşılıklı görün</p>
        </div>
      </button>

      <Modal acik={acik} baslik="Aile Bütçesi" onKapat={() => setAcik(false)}>
        {loading ? (
          <Skeleton satirlar={3} />
        ) : !baglanti ? (
          <>
            <p className="text-xs text-muted mb-4">
              Partnerinin e-postasını gir, o onayladıktan sonra birbirinizin **toplu** finansal özetini (toplam borç, bu ay net, toplam birikim) görebilirsiniz. Tek tek borç/işlem detayları asla paylaşılmaz.
            </p>
            <form onSubmit={handleDavetGonder} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Partnerinin E-postası</label>
                <input type="email" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
              </div>
              <button type="submit" disabled={gonderiliyor}
                className="bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
                {gonderiliyor ? 'Gönderiliyor...' : 'Davet Gönder'}
              </button>
              {message && <p className="text-xs text-brick mt-1">{message}</p>}
            </form>
          </>
        ) : benBekleyenTaraf ? (
          <div className="text-center py-4">
            <Monogram isim={baglanti.davet_edilen_email} boyut={44} />
            <p className="text-sm text-navy mt-3 mb-1">
              <b>Bir davet aldın</b>
            </p>
            <p className="text-xs text-muted mb-5">Aile bütçesi bağlantısı için onayını bekliyor.</p>
            <div className="flex gap-2">
              <button onClick={handleOnayla} className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors">
                Onayla
              </button>
              <button onClick={() => setOnaySilAcik(true)} className="flex-1 bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 hover:bg-paper transition-colors">
                Reddet
              </button>
            </div>
          </div>
        ) : baglanti.durum === 'bekliyor' ? (
          <div className="text-center py-4">
            <p className="text-sm text-navy mb-1">Davet gönderildi</p>
            <p className="text-xs text-muted mb-5">{baglanti.davet_edilen_email} onayını bekliyorsun.</p>
            <button onClick={() => setOnaySilAcik(true)} className="text-xs text-brick underline">Daveti İptal Et</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-2">Sen</p>
                {benimOzet && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-muted">Borç <span className="float-right font-mono text-navy">{benimOzet.borc.toLocaleString('tr-TR')} ₺</span></p>
                    <p className="text-[11px] text-muted">Bu Ay Net <span className={`float-right font-mono ${benimOzet.net >= 0 ? 'text-sage' : 'text-brick'}`}>{benimOzet.net.toLocaleString('tr-TR')} ₺</span></p>
                    <p className="text-[11px] text-muted">Birikim <span className="float-right font-mono text-navy">{benimOzet.birikim.toLocaleString('tr-TR')} ₺</span></p>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-2">Partnerin</p>
                {partnerOzet && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-muted">Borç <span className="float-right font-mono text-navy">{Number(partnerOzet.toplam_borc).toLocaleString('tr-TR')} ₺</span></p>
                    <p className="text-[11px] text-muted">Bu Ay Net <span className={`float-right font-mono ${Number(partnerOzet.bu_ay_net) >= 0 ? 'text-sage' : 'text-brick'}`}>{Number(partnerOzet.bu_ay_net).toLocaleString('tr-TR')} ₺</span></p>
                    <p className="text-[11px] text-muted">Birikim <span className="float-right font-mono text-navy">{Number(partnerOzet.toplam_birikim).toLocaleString('tr-TR')} ₺</span></p>
                  </div>
                )}
              </div>
            </div>

            {benimOzet && partnerOzet && (
              <div className="bg-sage-soft rounded-lg p-3 mb-4">
                <p className="text-xs text-muted mb-1">Birlikte Toplam Borç</p>
                <p className="font-mono text-xl font-medium text-navy">
                  {(benimOzet.borc + Number(partnerOzet.toplam_borc)).toLocaleString('tr-TR')} ₺
                </p>
              </div>
            )}

            <button onClick={() => setOnaySilAcik(true)} className="text-xs text-brick underline">Bağlantıyı Kaldır</button>
          </>
        )}
      </Modal>

      <OnayModal
        acik={onaySilAcik}
        baslik="Emin misin?"
        mesaj="Aile bütçesi bağlantısını kaldırmak istediğine emin misin?"
        onOnayla={gercekBaglantiyiSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

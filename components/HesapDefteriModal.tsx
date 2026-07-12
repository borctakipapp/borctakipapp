'use client'

import { useState } from 'react'
import Modal from './Modal'
import Monogram from './Monogram'

type Uye = { user_id: string; ad_soyad: string | null }
type Harcama = { id: string; odeyen_id: string; aciklama: string; tutar: number; tarih: string }
type Bolusum = { harcama_id: string; user_id: string; pay_tutari: number }
type Odeme = { odeyen_id: string; alan_id: string; tutar: number }

// "Kim kime borçlu" önerisi en az transfer sayısına indirgenmiş olduğu için, tek bir önerilen
// ödeme genelde birebir bir harcamayla eşleşmez (örn. hiç ortak harcaması olmayan iki kişi
// arasında bir transfer önerilebilir). Bu modal, o basitleştirmenin ARKASINDAKİ ham hesabı
// (kim ne kadar ödedi, payına ne düştü, harcama harcama dökümü) şeffafça gösteriyor.
export default function HesapDefteriModal({
  uyeler, harcamalar, bolusumler, odemeler, tetikleyici,
}: {
  uyeler: Uye[]
  harcamalar: Harcama[]
  bolusumler: Bolusum[]
  odemeler: Odeme[]
  tetikleyici: React.ReactNode
}) {
  const [acik, setAcik] = useState(false)

  const kisiOzetleri = uyeler.map((u) => {
    const odedigi = harcamalar.filter((h) => h.odeyen_id === u.user_id).reduce((s, h) => s + Number(h.tutar), 0)
    const payinaDusen = bolusumler.filter((b) => b.user_id === u.user_id).reduce((s, b) => s + Number(b.pay_tutari), 0)
    const mutabakatAldigi = odemeler.filter((o) => o.alan_id === u.user_id).reduce((s, o) => s + Number(o.tutar), 0)
    const mutabakatOdedigi = odemeler.filter((o) => o.odeyen_id === u.user_id).reduce((s, o) => s + Number(o.tutar), 0)
    const net = odedigi - payinaDusen + mutabakatAldigi - mutabakatOdedigi
    return { ...u, odedigi, payinaDusen, net }
  })

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Hesap Defteri" onKapat={() => setAcik(false)}>
        <p className="text-xs text-muted mb-4">
          "Kim kime borçlu" listesi, en az sayıda transferle herkesin hesabını kapatacak şekilde
          önerilir — bu yüzden önerilen bir ödeme, senin doğrudan katıldığın bir harcamayla
          birebir eşleşmeyebilir. Önemli olan herkesin <b>net bakiyesinin</b> doğru olması.
          Aşağıda ham hesabı (kim ne kadar ödedi, payına ne düştü) görebilirsin.
        </p>

        <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Kişi Bazlı Özet</h3>
        <div className="flex flex-col gap-2 mb-5">
          {kisiOzetleri.map((k) => (
            <div key={k.user_id} className="bg-white rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Monogram isim={k.ad_soyad || '?'} boyut={26} />
                <p className="text-sm text-navy font-medium flex-1 truncate">{k.ad_soyad}</p>
                <span className={`font-mono text-sm font-medium ${k.net >= 0 ? 'text-sage' : 'text-brick'}`}>
                  {k.net >= 0 ? '+' : ''}{k.net.toLocaleString('tr-TR')} ₺
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted pl-8">
                <span>Ödediği: <span className="font-mono text-navy">{k.odedigi.toLocaleString('tr-TR')} ₺</span></span>
                <span>Payına düşen: <span className="font-mono text-navy">{k.payinaDusen.toLocaleString('tr-TR')} ₺</span></span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Harcama Dökümü</h3>
        {harcamalar.length === 0 ? (
          <p className="text-xs text-muted">Henüz harcama yok.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {harcamalar.map((h) => {
              const odeyen = uyeler.find((u) => u.user_id === h.odeyen_id)
              const buHarcamaBolusumu = bolusumler.filter((b) => b.harcama_id === h.id)
              return (
                <div key={h.id} className="bg-white rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-navy">{h.aciklama}</p>
                    <span className="font-mono text-xs text-navy">{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <p className="text-[11px] text-muted mb-1.5">{odeyen?.ad_soyad || 'Bilinmeyen'} ödedi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {buHarcamaBolusumu.map((b) => {
                      const kisi = uyeler.find((u) => u.user_id === b.user_id)
                      return (
                        <span key={b.user_id} className="text-[10px] bg-paper rounded px-1.5 py-0.5 text-muted">
                          {kisi?.ad_soyad || '?'}: {Number(b.pay_tutari).toLocaleString('tr-TR')} ₺
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}
'use client'

import { useState } from 'react'
import Link from 'next/link'
import BirikimHedefModal from './BirikimHedefModal'
import BorcDetayModal from './BorcDetayModal'
import CubukGrafik from './CubukGrafik'
import AileButcesiModal from './AileButcesiModal'

type Borc = { id: string; institution_name: string; interest_rate: number | null; remaining_amount: number }
type YakinOdeme = { id: string; institution_name: string; remaining_amount: number; gunKaldi: number }
type Hedef = { id: string; goal_name: string; current_amount: number; target_amount: number }
type Rozet = { anahtar: string; ikon: string; etiket: string; kazanildi: boolean }
type GiderKalemi = { kategori: string; tutar: number; renk: string }

export default function OzetSekmeler({
  enYuksekFaizliBorc, enYakinOdeme, buAyNet, borcGelirOrani, oncekiVeriVar, oncekiAyNet,
  streakAySayisi, aktifHedef, aktifHedefOrani, odemeTrendi, rozetler,
  toplamBirikim, netDurumGenel, yaklasanlar, giderListesi, enBuyukGider,
}: {
  enYuksekFaizliBorc: Borc | undefined
  enYakinOdeme: YakinOdeme | undefined
  buAyNet: number
  borcGelirOrani: number | null
  oncekiVeriVar: boolean
  oncekiAyNet: number
  streakAySayisi: number
  aktifHedef: Hedef | undefined
  aktifHedefOrani: number
  odemeTrendi: { etiket: string; tutar: number }[]
  rozetler: Rozet[]
  toplamBirikim: number
  netDurumGenel: number
  yaklasanlar: YakinOdeme[]
  giderListesi: GiderKalemi[]
  enBuyukGider: number
}) {
  const [sekme, setSekme] = useState<'bugun' | 'grafikler' | 'detaylar'>('bugun')

  const SEKMELER = [
    { key: 'bugun' as const, etiket: 'Bugün' },
    { key: 'grafikler' as const, etiket: 'Grafikler' },
    { key: 'detaylar' as const, etiket: `Detaylar (${yaklasanlar.length})` },
  ]

  return (
    <>
      <div className="flex gap-1 bg-white border border-border rounded-lg p-1 mb-6">
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

      {/* --- SEKME: BUGÜN --- */}
      {sekme === 'bugun' && (
        <>
          {enYuksekFaizliBorc && (
            <BorcDetayModal
              debtId={enYuksekFaizliBorc.id}
              tetikleyici={
                <div className="block bg-white rounded-lg border border-border p-5 mb-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Öncelik Önerisi</h2>
                  <p className="text-sm text-navy">
                    Önce <b>{enYuksekFaizliBorc.institution_name}</b> borcuna odaklan — faiz oranı (%{Number(enYuksekFaizliBorc.interest_rate).toLocaleString('tr-TR')}) diğerlerinden yüksek, erken kapatman en çok burada tasarruf sağlar.
                  </p>
                </div>
              }
            />
          )}

          <div className="bg-white rounded-lg border border-border p-5 flex flex-col gap-3">
            <h2 className="text-xs font-medium text-muted uppercase tracking-wide">Bugün</h2>

            {enYakinOdeme && (
              <BorcDetayModal
                debtId={enYakinOdeme.id}
                tetikleyici={
                  <div className="flex items-start gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
                    <span className="text-lg leading-none">💳</span>
                    <p className="text-sm text-navy">
                      {enYakinOdeme.gunKaldi < 0 && <><b>{enYakinOdeme.institution_name}</b> ödemesi {Math.abs(enYakinOdeme.gunKaldi)} gün gecikti.</>}
                      {enYakinOdeme.gunKaldi === 0 && <><b>{enYakinOdeme.institution_name}</b> için bugün son gün.</>}
                      {enYakinOdeme.gunKaldi > 0 && <>{enYakinOdeme.gunKaldi} gün sonra <b>{enYakinOdeme.institution_name}</b> ödemen var — {Number(enYakinOdeme.remaining_amount).toLocaleString('tr-TR')} ₺</>}
                    </p>
                  </div>
                }
              />
            )}

            <Link href="/dashboard/gelir-gider" className="flex items-start gap-2.5 hover:opacity-80 transition-opacity">
              <span className="text-lg leading-none">💰</span>
              <p className="text-sm text-navy">
                Bu ay elinde kalan: <b className="font-mono">{buAyNet.toLocaleString('tr-TR')} ₺</b>
              </p>
            </Link>

            {borcGelirOrani !== null && borcGelirOrani > 0.5 && (
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none">⚠️</span>
                <p className="text-sm text-brick">
                  Gelirinin yaklaşık %{Math.round(borcGelirOrani * 100)}'i borca gidiyor — dikkatli ol.
                </p>
              </div>
            )}

            {oncekiVeriVar && (
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none">📉</span>
                {buAyNet >= oncekiAyNet ? (
                  <p className="text-sm text-navy">Bu ay geçen aya göre net durumun <b className="text-sage">iyileşti</b></p>
                ) : (
                  <p className="text-sm text-navy">Bu ay geçen aya göre net durumun <b className="text-brick">zayıfladı</b></p>
                )}
              </div>
            )}

            {streakAySayisi >= 2 && (
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none">🔥</span>
                <p className="text-sm text-navy">
                  <b className="text-sage">{streakAySayisi} ay üst üste</b> net pozitiftesin, harika gidiyor
                </p>
              </div>
            )}

            {aktifHedef && (
              <BirikimHedefModal
                goalId={aktifHedef.id}
                tetikleyici={
                  <div className="flex items-start gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
                    <span className="text-lg leading-none">🎯</span>
                    <p className="text-sm text-navy">
                      <b>{aktifHedef.goal_name}</b> hedefinde %{aktifHedefOrani.toFixed(0)} yoldasın
                    </p>
                  </div>
                }
              />
            )}

            {!enYakinOdeme && !aktifHedef && (
              <p className="text-sm text-muted">Şu an takip edilecek yaklaşan bir şey yok — güzel bir gün!</p>
            )}
          </div>
        </>
      )}

      {/* --- SEKME: GRAFİKLER --- */}
      {sekme === 'grafikler' && (
        <>
          {odemeTrendi.length > 0 && odemeTrendi.some((o) => o.tutar > 0) && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ay Ödeme Trendi</h2>
              <div className="bg-white rounded-lg border border-border p-5">
                <CubukGrafik veriler={odemeTrendi} renk="#1B2A4A" />
              </div>
            </div>
          )}

          <div className="mb-6">
            <AileButcesiModal />
          </div>

          <h2 className="text-sm font-medium text-muted mb-3">Başarılarım</h2>
          <div className="grid grid-cols-4 gap-2">
            {rozetler.map((r) => (
              <div
                key={r.anahtar}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center ${
                  r.kazanildi ? 'bg-sage-soft border-sage' : 'bg-white border-border opacity-40'
                }`}
              >
                <span className="text-xl">{r.ikon}</span>
                <span className="text-[10px] text-navy leading-tight">{r.etiket}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- SEKME: DETAYLAR --- */}
      {sekme === 'detaylar' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link href="/dashboard/birikim" className="bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow">
              <p className="text-xs text-muted mb-1">Toplam Birikim</p>
              <p className="font-mono text-lg text-navy font-medium">{toplamBirikim.toLocaleString('tr-TR')} ₺</p>
            </Link>
            <div className="bg-white rounded-lg p-4 border border-border">
              <p className="text-xs text-muted mb-1">Net Varlık</p>
              <p className={`font-mono text-lg font-medium ${netDurumGenel >= 0 ? 'text-navy' : 'text-brick'}`}>{netDurumGenel.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>

          <h2 className="text-sm font-medium text-muted mb-3">
            Yaklaşan Ödemeler {yaklasanlar.length > 0 && <span className="text-muted/60">({yaklasanlar.length})</span>}
          </h2>
          {yaklasanlar.length === 0 ? (
            <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border mb-6">Yaklaşan bir ödemen yok.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-6">
              {yaklasanlar.map((y) => {
                const renk = y.gunKaldi <= 0 ? 'border-brick' : y.gunKaldi <= 5 ? 'border-amber' : 'border-sage'
                const etiket = y.gunKaldi < 0 ? `${Math.abs(y.gunKaldi)} gün gecikti` : y.gunKaldi === 0 ? 'Bugün son gün' : `${y.gunKaldi} gün kaldı`
                return (
                  <BorcDetayModal
                    key={y.id}
                    debtId={y.id}
                    tetikleyici={
                      <div className={`bg-white rounded-lg pl-4 pr-4 py-3 flex items-center justify-between border-l-4 ${renk} hover:shadow-sm transition-shadow cursor-pointer`}>
                        <div>
                          <p className="font-medium text-navy text-sm">{y.institution_name}</p>
                          <p className="text-xs text-muted mt-0.5">{etiket}</p>
                        </div>
                        <span className="font-mono text-navy text-sm">{Number(y.remaining_amount).toLocaleString('tr-TR')} ₺</span>
                      </div>
                    }
                  />
                )
              })}
            </div>
          )}

          {giderListesi.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">Bu Ayki Gider Dağılımı</h2>
              <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5">
                {giderListesi.map((g) => (
                  <div key={g.kategori} className="flex items-center gap-3">
                    <span className="text-xs text-navy w-28 shrink-0 truncate">{g.kategori}</span>
                    <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                      <div style={{ width: `${(g.tutar / enBuyukGider) * 100}%`, backgroundColor: g.renk }} className="h-full rounded-full" />
                    </div>
                    <span className="font-mono text-xs text-muted w-20 text-right shrink-0">{g.tutar.toLocaleString('tr-TR')} ₺</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

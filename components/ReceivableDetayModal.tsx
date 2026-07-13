'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import OnayModal from './OnayModal'
import Skeleton from './Skeleton'
import { useToast } from './Toast'
import { hataMesajiCevir } from '@/lib/hata-mesaji'
import { tahsilatKaydet } from '@/lib/receivable-service'

export type Receivable = {
  id: string
  contact_name: string
  description: string | null
  total_amount: number
  remaining_amount: number
  expected_date: string | null
  status: 'pending' | 'completed' | 'cancelled'
  closed_at: string | null
}

type Tahsilat = { id: string; amount: number; paid_at: string }

const DURUM_ETIKET: Record<string, { etiket: string; renk: string }> = {
  pending: { etiket: 'Bekliyor', renk: 'bg-amber-soft text-amber' },
  completed: { etiket: 'Tamamlandı', renk: 'bg-sage-soft text-sage' },
  cancelled: { etiket: 'İptal Edildi', renk: 'bg-paper text-muted' },
}

export default function ReceivableDetayModal({
  receivable, tetikleyici,
}: {
  receivable: Receivable
  tetikleyici: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const { goster } = useToast()

  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [tahsilatlar, setTahsilatlar] = useState<Tahsilat[]>([])

  // Sunucudan gelen receivable prop'u, tahsilat sonrası ANINDA güncel görünsün diye
  // ayrıca kendi local state'imizde tutuyoruz (modal kapanmadan rakam değişsin diye).
  const [guncelReceivable, setGuncelReceivable] = useState(receivable)
  useEffect(() => { setGuncelReceivable(receivable) }, [receivable])

  const [tahsilatFormuAcik, setTahsilatFormuAcik] = useState(false)
  const [tahsilatTutari, setTahsilatTutari] = useState('')
  const [tahsilatKaydediliyor, setTahsilatKaydediliyor] = useState(false)
  const [tahsilatHata, setTahsilatHata] = useState('')

  const [duzenleAcik, setDuzenleAcik] = useState(false)
  const [duzenleContactName, setDuzenleContactName] = useState(receivable.contact_name)
  const [duzenleDescription, setDuzenleDescription] = useState(receivable.description || '')
  const [duzenleExpectedDate, setDuzenleExpectedDate] = useState(receivable.expected_date || '')
  const [duzenleKaydediliyor, setDuzenleKaydediliyor] = useState(false)

  const [onayIptalAcik, setOnayIptalAcik] = useState(false)
  const [onaySilAcik, setOnaySilAcik] = useState(false)

  const fetchTahsilatlar = useCallback(async () => {
    setYukleniyor(true)
    const { data } = await supabase
      .from('receivable_payments')
      .select('id, amount, paid_at')
      .eq('receivable_id', receivable.id)
      .order('paid_at', { ascending: false })
    setTahsilatlar(data || [])
    setYukleniyor(false)
  }, [receivable.id, supabase])

  useEffect(() => { if (acik) fetchTahsilatlar() }, [acik, fetchTahsilatlar])

  function ac() {
    setGuncelReceivable(receivable)
    setDuzenleContactName(receivable.contact_name)
    setDuzenleDescription(receivable.description || '')
    setDuzenleExpectedDate(receivable.expected_date || '')
    setAcik(true)
  }

  function kapat() {
    setAcik(false)
    setTahsilatFormuAcik(false); setTahsilatTutari(''); setTahsilatHata('')
    setDuzenleAcik(false)
  }

  async function tahsilatiKaydet(e: React.FormEvent) {
    e.preventDefault()
    setTahsilatHata('')
    const tutar = parseFloat(tahsilatTutari)
    if (!tutar || tutar <= 0) { setTahsilatHata('Tutarı gir.'); return }

    setTahsilatKaydediliyor(true)
    const sonuc = await tahsilatKaydet(guncelReceivable.id, tutar)
    setTahsilatKaydediliyor(false)

    if (!sonuc.basarili) {
      setTahsilatHata(sonuc.hata)
      return
    }

    // Rakamı modal AÇIKKEN anında güncelle — kullanıcı sonucu hemen görsün.
    setGuncelReceivable((onceki) => ({ ...onceki, remaining_amount: sonuc.yeniKalanTutar, status: sonuc.yeniDurum }))
    setTahsilatTutari('')
    setTahsilatFormuAcik(false)
    goster(sonuc.yeniDurum === 'completed' ? 'Tahsilat kaydedildi — alacak tamamlandı! 🎉' : 'Tahsilat kaydedildi.')
    fetchTahsilatlar()
    router.refresh()
  }

  async function duzenlemeyiKaydet(e: React.FormEvent) {
    e.preventDefault()
    if (!duzenleContactName.trim()) return

    setDuzenleKaydediliyor(true)
    const { error } = await supabase.from('receivables').update({
      contact_name: duzenleContactName.trim(),
      description: duzenleDescription.trim() || null,
      expected_date: duzenleExpectedDate || null,
    }).eq('id', guncelReceivable.id)
    setDuzenleKaydediliyor(false)

    if (error) {
      goster(hataMesajiCevir(error), 'hata')
    } else {
      setGuncelReceivable((onceki) => ({
        ...onceki, contact_name: duzenleContactName.trim(),
        description: duzenleDescription.trim() || null, expected_date: duzenleExpectedDate || null,
      }))
      setDuzenleAcik(false)
      goster('Bilgiler güncellendi.')
      router.refresh()
    }
  }

  async function gercekIptalEt() {
    setOnayIptalAcik(false)
    const { error } = await supabase.from('receivables').update({
      status: 'cancelled', closed_at: new Date().toISOString(),
    }).eq('id', guncelReceivable.id)

    if (error) {
      goster(hataMesajiCevir(error), 'hata')
    } else {
      goster('Alacak iptal edildi.')
      kapat()
      router.refresh()
    }
  }

  async function gercekSil() {
    setOnaySilAcik(false)
    const { error } = await supabase.from('receivables').delete().eq('id', guncelReceivable.id)

    if (error) {
      goster(hataMesajiCevir(error), 'hata')
    } else {
      goster('Alacak silindi.')
      kapat()
      router.refresh()
    }
  }

  const durum = DURUM_ETIKET[guncelReceivable.status]
  const duzenlenebilir = guncelReceivable.status === 'pending'

  return (
    <>
      <span onClick={ac} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik={guncelReceivable.contact_name} onKapat={kapat}>
        <div className="flex items-center justify-between mb-4">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${durum.renk}`}>{durum.etiket}</span>
          <p className={`font-mono text-2xl font-medium ${guncelReceivable.status === 'completed' ? 'text-sage' : 'text-navy'}`}>
            {guncelReceivable.remaining_amount.toLocaleString('tr-TR')} ₺
          </p>
        </div>

        {guncelReceivable.description && (
          <p className="text-sm text-muted mb-1">{guncelReceivable.description}</p>
        )}
        {guncelReceivable.total_amount !== guncelReceivable.remaining_amount && (
          <p className="text-xs text-muted mb-4">
            Toplam {guncelReceivable.total_amount.toLocaleString('tr-TR')} ₺ üzerinden {(guncelReceivable.total_amount - guncelReceivable.remaining_amount).toLocaleString('tr-TR')} ₺ tahsil edildi
          </p>
        )}

        {/* --- Tahsilat Ekle --- */}
        {duzenlenebilir && (
          <div className="mb-4">
            {!tahsilatFormuAcik ? (
              <button onClick={() => setTahsilatFormuAcik(true)}
                className="w-full bg-sage-soft text-sage text-sm font-medium rounded-lg py-2.5 hover:opacity-80 transition-opacity">
                + Tahsilat Ekle
              </button>
            ) : (
              <form onSubmit={tahsilatiKaydet} className="bg-paper rounded-lg p-3 flex flex-col gap-2">
                <label className="text-xs text-muted">Tahsil Edilen Tutar (₺)</label>
                <input type="number" step="0.01" value={tahsilatTutari} onChange={(e) => setTahsilatTutari(e.target.value)}
                  autoFocus required className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono" />
                <div className="flex gap-2 mt-1">
                  <button type="submit" disabled={tahsilatKaydediliyor}
                    className="flex-1 bg-sage text-white text-sm font-medium rounded-lg py-2 hover:opacity-90 transition-opacity disabled:opacity-60">
                    {tahsilatKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button type="button" onClick={() => { setTahsilatFormuAcik(false); setTahsilatHata('') }}
                    className="px-4 text-sm text-muted hover:text-navy transition-colors">
                    Vazgeç
                  </button>
                </div>
                {tahsilatHata && <p className="text-xs text-brick">{tahsilatHata}</p>}
              </form>
            )}
          </div>
        )}

        {/* --- Tahsilat Geçmişi --- */}
        <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Tahsilat Geçmişi</h3>
        {yukleniyor ? (
          <Skeleton satirlar={2} />
        ) : tahsilatlar.length === 0 ? (
          <p className="text-xs text-muted mb-4">Henüz tahsilat yapılmadı.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-4">
            {tahsilatlar.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-paper rounded-lg px-3 py-2">
                <span className="text-xs text-muted">{new Date(t.paid_at).toLocaleDateString('tr-TR')}</span>
                <span className="font-mono text-xs text-navy">{Number(t.amount).toLocaleString('tr-TR')} ₺</span>
              </div>
            ))}
          </div>
        )}

        {/* --- Düzenle --- */}
        <div className="border-t border-border pt-4 mt-2">
          {!duzenleAcik ? (
            <button onClick={() => setDuzenleAcik(true)} className="text-xs text-navy underline">
              Bilgileri Düzenle
            </button>
          ) : (
            <form onSubmit={duzenlemeyiKaydet} className="flex flex-col gap-2 mt-2">
              <div>
                <label className="text-xs text-muted mb-1 block">Kimden Alacaklısın</label>
                <input type="text" value={duzenleContactName} onChange={(e) => setDuzenleContactName(e.target.value)} required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Not</label>
                <input type="text" value={duzenleDescription} onChange={(e) => setDuzenleDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Beklenen Tarih</label>
                <input type="date" value={duzenleExpectedDate} onChange={(e) => setDuzenleExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div className="flex gap-2 mt-1">
                <button type="submit" disabled={duzenleKaydediliyor}
                  className="flex-1 bg-navy text-paper text-sm font-medium rounded-lg py-2 hover:bg-navy-light transition-colors disabled:opacity-60">
                  {duzenleKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button type="button" onClick={() => setDuzenleAcik(false)} className="px-4 text-sm text-muted hover:text-navy transition-colors">
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </div>

        {/* --- İptal Et / Sil --- */}
        {duzenlenebilir && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-border">
            <button onClick={() => setOnayIptalAcik(true)} className="text-xs text-amber underline">İptal Et</button>
            <button onClick={() => setOnaySilAcik(true)} className="text-xs text-brick underline">Sil</button>
          </div>
        )}
        {!duzenlenebilir && (
          <div className="mt-4 pt-4 border-t border-border">
            <button onClick={() => setOnaySilAcik(true)} className="text-xs text-brick underline">Kaydı Sil</button>
          </div>
        )}
      </Modal>

      <OnayModal
        acik={onayIptalAcik}
        baslik="Alacağı iptal et"
        mesaj={`"${guncelReceivable.contact_name}" alacağını iptal etmek istediğine emin misin? İptal ettikten sonra bir daha tahsilat kaydedemezsin.`}
        onayMetni="Evet, İptal Et"
        tehlikeli
        onOnayla={gercekIptalEt}
        onVazgec={() => setOnayIptalAcik(false)}
      />

      <OnayModal
        acik={onaySilAcik}
        baslik="Alacağı sil"
        mesaj={`"${guncelReceivable.contact_name}" alacağını ve tahsilat geçmişini kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.`}
        onayMetni="Evet, Sil"
        tehlikeli
        onOnayla={gercekSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}
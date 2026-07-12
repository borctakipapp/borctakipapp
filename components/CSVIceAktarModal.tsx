'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'

type Satir = {
  type: 'income' | 'expense' | null
  category: string
  amount: number | null
  date: string
  description: string
  hata: string | null
}

// Basit CSV ayrıştırıcı — tırnak içindeki virgülleri koruyor (harici kütüphane gerektirmez)
function csvSatiriAyir(satir: string): string[] {
  const sonuc: string[] = []
  let mevcut = ''
  let tirnakIci = false
  for (let i = 0; i < satir.length; i++) {
    const ch = satir[i]
    if (ch === '"') tirnakIci = !tirnakIci
    else if (ch === ',' && !tirnakIci) { sonuc.push(mevcut.trim()); mevcut = '' }
    else mevcut += ch
  }
  sonuc.push(mevcut.trim())
  return sonuc
}

function ornekSablonIndir() {
  const icerik = 'Tür,Kategori,Tutar,Tarih,Açıklama\ngelir,Maaş,20000,2026-07-01,Temmuz maaşı\ngider,Market/Gıda,450.50,2026-07-03,Migros alışverişi\n'
  const blob = new Blob(['\uFEFF' + icerik], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ornek-sablon.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CSVIceAktarModal() {
  const router = useRouter()
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [message, setMessage] = useState('')

  function sifirlaVeKapat() {
    setAcik(false)
    setSatirlar([]); setMessage('')
  }

  function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    if (!dosya) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const metin = event.target?.result as string
      const satirlarHam = metin.split(/\r?\n/).filter((s) => s.trim().length > 0)
      const veriSatirlari = satirlarHam.slice(1) // ilk satır başlık

      const ayristirilmis: Satir[] = veriSatirlari.map((satir) => {
        const [turHam, kategori, tutarHam, tarih, aciklama] = csvSatiriAyir(satir)
        const turKucuk = (turHam || '').toLowerCase().trim()
        const type: 'income' | 'expense' | null =
          turKucuk === 'gelir' || turKucuk === 'income' ? 'income' :
          turKucuk === 'gider' || turKucuk === 'expense' ? 'expense' : null
        const amount = parseFloat((tutarHam || '').replace(',', '.'))

        let hata: string | null = null
        if (!type) hata = 'Tür "gelir" veya "gider" olmalı'
        else if (!kategori) hata = 'Kategori boş olamaz'
        else if (!amount || amount <= 0) hata = 'Tutar geçersiz'
        else if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) hata = 'Tarih YYYY-AA-GG formatında olmalı'

        return { type, category: kategori || '', amount: isNaN(amount) ? null : amount, date: tarih || '', description: aciklama || '', hata }
      })

      setSatirlar(ayristirilmis)
    }
    reader.readAsText(dosya, 'UTF-8')
  }

  const gecerliSatirlar = satirlar.filter((s) => !s.hata)
  const hataliSatirSayisi = satirlar.length - gecerliSatirlar.length

  async function iceAktar() {
    if (gecerliSatirlar.length === 0) return
    setYukleniyor(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Oturum bulunamadı.'); setYukleniyor(false); return }

    const kayitlar = gecerliSatirlar.map((s) => ({
      user_id: user.id,
      type: s.type,
      category: s.category,
      amount: s.amount,
      transaction_date: s.date,
      description: s.description || null,
      is_recurring: false,
      recurring_id: null,
    }))

    const { error } = await supabase.from('transactions').insert(kayitlar)

    setYukleniyor(false)
    if (error) {
      setMessage('Hata: ' + error.message)
    } else {
      sifirlaVeKapat()
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="bg-white border border-border text-navy text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-paper transition-colors"
      >
        ⬆ CSV İçe Aktar
      </button>

      <Modal acik={acik} baslik="CSV İçe Aktar" onKapat={sifirlaVeKapat}>
        <p className="text-xs text-muted mb-3">
          Excel'den ya da başka bir uygulamadan dışa aktardığın gelir-gider kayıtlarını toplu olarak ekleyebilirsin.
        </p>
        <button onClick={ornekSablonIndir} className="text-xs text-navy underline mb-4 block">
          ⬇ Örnek şablon indir
        </button>

        <input
          type="file" accept=".csv" onChange={dosyaSecildi}
          className="w-full text-sm mb-4 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-navy file:text-paper file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
        />

        {satirlar.length > 0 && (
          <>
            <p className="text-xs mb-2">
              <span className="text-sage font-medium">{gecerliSatirlar.length} geçerli</span>
              {hataliSatirSayisi > 0 && <span className="text-brick font-medium"> · {hataliSatirSayisi} hatalı (atlanacak)</span>}
            </p>
            <div className="max-h-56 overflow-y-auto border border-border rounded-lg mb-4">
              {satirlar.map((s, i) => (
                <div key={i} className={`px-3 py-2 text-xs border-b border-border last:border-0 ${s.hata ? 'bg-brick-soft' : 'bg-white'}`}>
                  {s.hata ? (
                    <span className="text-brick">Satır {i + 2}: {s.hata}</span>
                  ) : (
                    <span className="text-navy">
                      {s.type === 'income' ? '↑' : '↓'} {s.category} · {s.amount?.toLocaleString('tr-TR')} ₺ · {s.date}
                      {s.description && ` · ${s.description}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={iceAktar} disabled={yukleniyor || gecerliSatirlar.length === 0}
              className="w-full bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
            >
              {yukleniyor ? 'Aktarılıyor...' : `${gecerliSatirlar.length} kaydı içe aktar`}
            </button>
          </>
        )}

        {message && <p className="text-xs text-brick mt-2">{message}</p>}
      </Modal>
    </>
  )
}

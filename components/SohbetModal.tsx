'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'

type Mesaj = { id: string; gonderen_id: string; gonderen_ad: string | null; mesaj: string; created_at: string }

export default function SohbetModal({ grupId, grupAdi }: { grupId: string; grupAdi: string }) {
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([])
  const [yeniMesaj, setYeniMesaj] = useState('')
  const [mevcutKullaniciId, setMevcutKullaniciId] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const sonaKaydirRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return

    async function baslat() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMevcutKullaniciId(user.id)

      const { data } = await supabase
        .from('grup_mesajlar').select('*').eq('grup_id', grupId).order('created_at', { ascending: true })
      setMesajlar(data || [])
    }
    baslat()

    const kanal = supabase
      .channel(`grup-sohbet-${grupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grup_mesajlar', filter: `grup_id=eq.${grupId}` },
        (payload) => setMesajlar((prev) => [...prev, payload.new as Mesaj])
      )
      .subscribe()

    return () => { supabase.removeChannel(kanal) }
  }, [acik, grupId])

  useEffect(() => {
    sonaKaydirRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mesajlar])

  async function mesajGonder(e: React.FormEvent) {
    e.preventDefault()
    if (!yeniMesaj.trim()) return
    setGonderiliyor(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGonderiliyor(false); return }

    await supabase.from('grup_mesajlar').insert({
      grup_id: grupId, gonderen_id: user.id, gonderen_ad: user.email, mesaj: yeniMesaj.trim(),
    })
    setYeniMesaj('')
    setGonderiliyor(false)
  }

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="flex-1 bg-white border border-border text-navy text-sm font-medium rounded-lg py-2.5 hover:bg-paper transition-colors"
      >
        💬 Sohbet
      </button>

      <Modal acik={acik} baslik={`Sohbet · ${grupAdi}`} onKapat={() => setAcik(false)}>
        <div className="flex flex-col h-[60vh]">
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {mesajlar.length === 0 && (
              <p className="text-muted text-sm text-center mt-8">Henüz mesaj yok, ilk mesajı sen at.</p>
            )}
            {mesajlar.map((m) => {
              const benim = m.gonderen_id === mevcutKullaniciId
              return (
                <div key={m.id} className={`flex flex-col ${benim ? 'items-end' : 'items-start'}`}>
                  {!benim && <span className="text-[10px] text-muted mb-0.5 ml-1">{m.gonderen_ad}</span>}
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${benim ? 'bg-navy text-paper' : 'bg-white border border-border text-navy'}`}>
                    {m.mesaj}
                  </div>
                  <span className="text-[9px] text-muted mt-0.5">
                    {new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            <div ref={sonaKaydirRef} />
          </div>

          <form onSubmit={mesajGonder} className="pt-3 flex gap-2 border-t border-border mt-2">
            <input
              type="text" value={yeniMesaj} onChange={(e) => setYeniMesaj(e.target.value)}
              placeholder="Mesaj yaz..."
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <button
              type="submit" disabled={gonderiliyor || !yeniMesaj.trim()}
              className="bg-navy text-paper text-sm font-medium rounded-lg px-4 hover:bg-navy-light transition-colors disabled:opacity-50"
            >
              Gönder
            </button>
          </form>
        </div>
      </Modal>
    </>
  )
}

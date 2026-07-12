'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mesaj = { id: string; gonderen_id: string; gonderen_ad: string | null; mesaj: string; created_at: string }

export default function SohbetPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const grupId = params.id as string

  const [grupAdi, setGrupAdi] = useState('')
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([])
  const [yeniMesaj, setYeniMesaj] = useState('')
  const [mevcutKullaniciId, setMevcutKullaniciId] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const sonaKaydirRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setMevcutKullaniciId(user.id)

    const { data: grup } = await supabase.from('gruplar').select('ad').eq('id', grupId).single()
    if (grup) setGrupAdi(grup.ad)

    const { data: mesajVerisi } = await supabase
      .from('grup_mesajlar')
      .select('*')
      .eq('grup_id', grupId)
      .order('created_at', { ascending: true })
    setMesajlar(mesajVerisi || [])
  }, [grupId])

  useEffect(() => { fetchData() }, [fetchData])

  // Canlı güncelleme: başka biri mesaj yazınca sayfayı yenilemeden anında görün
  useEffect(() => {
    const kanal = supabase
      .channel(`grup-sohbet-${grupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grup_mesajlar', filter: `grup_id=eq.${grupId}` },
        (payload) => {
          setMesajlar((prev) => [...prev, payload.new as Mesaj])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(kanal) }
  }, [grupId])

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
      grup_id: grupId,
      gonderen_id: user.id,
      gonderen_ad: user.email,
      mesaj: yeniMesaj.trim(),
    })

    setYeniMesaj('')
    setGonderiliyor(false)
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-navy px-6 py-4 flex items-center shrink-0">
        <button onClick={() => router.push(`/dashboard/gruplar/${grupId}`)} className="text-paper/70 hover:text-paper text-sm">
          ← {grupAdi || 'Grup'}
        </button>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 flex flex-col overflow-y-auto">
        {mesajlar.length === 0 && (
          <p className="text-muted text-sm text-center mt-8">Henüz mesaj yok, ilk mesajı sen at.</p>
        )}
        <div className="flex flex-col gap-2">
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
        </div>
        <div ref={sonaKaydirRef} />
      </main>

      <form onSubmit={mesajGonder} className="shrink-0 border-t border-border bg-white px-4 py-3 flex gap-2">
        <input
          type="text" value={yeniMesaj} onChange={(e) => setYeniMesaj(e.target.value)}
          placeholder="Mesaj yaz..."
          className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
        <button
          type="submit" disabled={gonderiliyor || !yeniMesaj.trim()}
          className="bg-navy text-paper text-sm font-medium rounded-lg px-4 hover:bg-navy-light transition-colors disabled:opacity-50"
        >
          Gönder
        </button>
      </form>
    </div>
  )
}

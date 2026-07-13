'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminGrupKullaniciArama({ baslangicDegeri }: { baslangicDegeri: string }) {
  const router = useRouter()
  const [deger, setDeger] = useState(baslangicDegeri)

  function ara(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/admin/gruplar?q=${encodeURIComponent(deger.trim())}`)
  }

  return (
    <form onSubmit={ara} className="flex gap-2">
      <input
        type="text" value={deger} onChange={(e) => setDeger(e.target.value)}
        placeholder="kullanici@ornek.com"
        className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-white"
      />
      <button type="submit" className="bg-navy text-paper text-sm font-medium rounded-lg px-4 hover:bg-navy-light transition-colors">
        Ara
      </button>
    </form>
  )
}

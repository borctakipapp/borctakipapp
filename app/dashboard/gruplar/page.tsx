import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Monogram from '@/components/Monogram'
import GrupOlusturModal from '@/components/GrupOlusturModal'
import { bakiyeHesapla } from '@/lib/grup-hesap'

export default async function GruplarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: uyelikler } = await supabase
    .from('grup_uyeler')
    .select('grup_id, aktif, gruplar(id, ad, davet_kodu, created_at)')
    .eq('user_id', user.id)

  const gruplar = (uyelikler || [])
    .map((u: any) => (u.gruplar ? { ...u.gruplar, aktif: u.aktif } : null))
    .filter(Boolean)

  // --- Her grup kartında "senin bakiyen" göstermek için — tek bir toplu sorgu seti,
  // grup başına ayrı ayrı sorgu ATMIYORUZ (N+1 sorgu sorunundan kaçınmak için). ---
  const grupIdleri = gruplar.map((g: { id: string }) => g.id)
  let bakiyelerHaritasi: Record<string, number> = {}

  if (grupIdleri.length > 0) {
    const [{ data: tumHarcamalar }, { data: tumOdemeler }] = await Promise.all([
      supabase.from('grup_harcamalar').select('id, grup_id, odeyen_id, tutar').in('grup_id', grupIdleri),
      supabase.from('grup_odemeler').select('grup_id, odeyen_id, alan_id, tutar').in('grup_id', grupIdleri),
    ])
    const harcamaIdleri = (tumHarcamalar || []).map((h) => h.id)
    const { data: tumBolusumler } = harcamaIdleri.length > 0
      ? await supabase.from('grup_harcama_bolusumu').select('harcama_id, user_id, pay_tutari').in('harcama_id', harcamaIdleri)
      : { data: [] }

    // --- FİNANS MOTORU (grup): bakiyeHesapla ile AYNI fonksiyon, detay sayfasıyla tekrar yok ---
    bakiyelerHaritasi = Object.fromEntries(
      grupIdleri.map((gid: string) => {
        const buGrupHarcamalari = (tumHarcamalar || []).filter((h) => h.grup_id === gid)
        const buGrupHarcamaIdleri = buGrupHarcamalari.map((h) => h.id)
        const buGrupBolusumleri = (tumBolusumler || []).filter((b) => buGrupHarcamaIdleri.includes(b.harcama_id))
        const buGrupOdemeleri = (tumOdemeler || []).filter((o) => o.grup_id === gid)
        const net = bakiyeHesapla(buGrupHarcamalari, buGrupBolusumleri, buGrupOdemeleri, [{ user_id: user.id, ad_soyad: '' }])[0]?.net || 0
        return [gid, net]
      })
    )
  }

  return (
          <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <p className="text-sm text-muted mb-1">Ortak Hesap</p>
        <p className="text-2xl font-medium text-navy mb-6">Gruplarım</p>

        <div className="mb-8">
          <GrupOlusturModal />
        </div>

        {gruplar.length === 0 ? (
          <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
            Henüz bir grubun yok. Tatil, ev arkadaşlığı gibi ortak harcamaları paylaştığın bir grup oluşturup arkadaşlarını davet edebilirsin.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {gruplar.map((g: any) => {
              const net = bakiyelerHaritasi[g.id] || 0
              return (
                <Link
                  key={g.id}
                  href={`/dashboard/gruplar/${g.id}`}
                  className={`bg-white rounded-lg p-4 border border-border hover:shadow-sm transition-shadow flex items-center gap-3 ${!g.aktif ? 'opacity-60' : ''}`}
                >
                  <Monogram isim={g.ad} boyut={38} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-navy text-sm truncate" title={g.ad}>
                      {g.ad}
                      {!g.aktif && <span className="ml-2 text-[10px] text-muted font-normal align-middle">· Ayrıldın</span>}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{new Date(g.created_at).toLocaleDateString('tr-TR')} tarihinde oluşturuldu</p>
                  </div>
                  {g.aktif && Math.abs(net) > 0.5 && (
                    <span className={`font-mono text-sm font-medium shrink-0 ${net >= 0 ? 'text-sage' : 'text-brick'}`}>
                      {net >= 0 ? '+' : ''}{net.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    
  )
}

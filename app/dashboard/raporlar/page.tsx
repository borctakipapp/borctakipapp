import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ayAraligiUret, ikiBasamak, ayKirilimiHesapla, aylikBirikimNetiHesapla, giderKategorileriHesapla,
} from '@/lib/finans-motoru'
import { GIDER_KATEGORI_RENK as KATEGORI_RENK } from '@/lib/gider-kategorileri'
import CubukGrafik from '@/components/CubukGrafik'

const AY_KISALTMALARI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export default async function RaporlarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const simdi = new Date()
  const yil = simdi.getFullYear()
  const ay = simdi.getMonth()
  const { bitis: bitisStr } = ayAraligiUret(yil, ay, 0)
  const altiAyOncekiTarih = new Date(simdi.getFullYear(), simdi.getMonth() - 5, 1)
  const altiAyBaslangicStr = `${altiAyOncekiTarih.getFullYear()}-${ikiBasamak(altiAyOncekiTarih.getMonth() + 1)}-01`

  // --- Bu rapor, Dashboard'un zaten yaptığı gibi (aynı desen) sadece "gösterim katmanı" —
  // hiçbir yeni hesaplama kuralı YAZILMADI, hepsi Finance Engine'deki mevcut fonksiyonlar. ---
  const { data: debtIds } = await supabase.from('debts').select('id').eq('user_id', userId)
  const idler = (debtIds || []).map((d) => d.id)

  const [{ data: transactions }, { data: payments }, { data: savingsEntries }] = await Promise.all([
    supabase.from('transactions').select('type, category, amount, transaction_date')
      .eq('user_id', userId).gte('transaction_date', altiAyBaslangicStr).lt('transaction_date', bitisStr),
    idler.length > 0
      ? supabase.from('payments').select('amount, paid_at').in('debt_id', idler).gte('paid_at', `${altiAyBaslangicStr}T00:00:00`)
      : Promise.resolve({ data: [] as { amount: number; paid_at: string }[] }),
    supabase.from('savings_goals').select('id').eq('user_id', userId).then(async ({ data: hedefler }) => {
      const hedefIdleri = (hedefler || []).map((h) => h.id)
      if (hedefIdleri.length === 0) return { data: [] as { amount: number; type: string; created_at: string }[] }
      return supabase.from('savings_entries').select('amount, type, created_at').in('goal_id', hedefIdleri).gte('created_at', `${altiAyBaslangicStr}T00:00:00`)
    }),
  ])

  const tx = transactions || []
  const pay = payments || []
  const entries = savingsEntries || []

  // 6 aylık trend dizileri — hepsi tek geçişte, mevcut ayKirilimiHesapla/aylikBirikimNetiHesapla
  const gelirTrendi: { etiket: string; tutar: number }[] = []
  const giderTrendi: { etiket: string; tutar: number }[] = []
  const borcOdemeTrendi: { etiket: string; tutar: number }[] = []
  const birikimTrendi: { etiket: string; tutar: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const aralik = ayAraligiUret(yil, ay, i)
    const kirilim = ayKirilimiHesapla(tx, pay, aralik.baslangic, aralik.bitis)
    const etiket = AY_KISALTMALARI[aralik.ayIndex]
    gelirTrendi.push({ etiket, tutar: kirilim.gelir })
    giderTrendi.push({ etiket, tutar: kirilim.gider })
    borcOdemeTrendi.push({ etiket, tutar: kirilim.borcOdeme })
    birikimTrendi.push({ etiket, tutar: Math.max(0, aylikBirikimNetiHesapla(entries, aralik.baslangic, aralik.bitis)) })
  }

  // Son 6 ayın TAMAMI için kategori dağılımı — giderKategorileriHesapla zaten tek ay için
  // kullanılıyordu (Özet/Gelir-Gider), burada aynı fonksiyona 6 aylık işlem listesi veriliyor —
  // ayrı bir "6 aylık toplama" kuralı YAZILMADI.
  const { liste: kategoriListesi, enBuyuk: enBuyukKategori } = giderKategorileriHesapla(tx, KATEGORI_RENK, 8)

  const veriYok = tx.length === 0 && pay.length === 0 && entries.length === 0

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <p className="text-sm text-muted mb-1">Analiz</p>
      <p className="text-2xl font-medium text-navy mb-8">Raporlar</p>

      {veriYok ? (
        <p className="text-muted text-sm bg-white rounded-lg p-4 border border-border">
          Henüz raporlanacak yeterli veri yok — birkaç işlem/ödeme kaydettikten sonra buraya dön.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ay Gelir</h2>
            <div className="bg-white rounded-lg border border-border p-5">
              <CubukGrafik veriler={gelirTrendi} renk="#4A7C74" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ay Gider</h2>
            <div className="bg-white rounded-lg border border-border p-5">
              <CubukGrafik veriler={giderTrendi} renk="#B5533C" />
            </div>
          </div>

          {borcOdemeTrendi.some((b) => b.tutar > 0) && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ay Borç Ödemesi</h2>
              <div className="bg-white rounded-lg border border-border p-5">
                <CubukGrafik veriler={borcOdemeTrendi} renk="#1B2A4A" />
              </div>
            </div>
          )}

          {birikimTrendi.some((b) => b.tutar > 0) && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ay Birikim Büyümesi</h2>
              <p className="text-[11px] text-muted mb-3">
                Sadece pozitif net birikim ayları gösteriliyor (birikimden çekim yapılan aylarda net negatif olabilir, grafikte 0 olarak görünür).
              </p>
              <div className="bg-white rounded-lg border border-border p-5">
                <CubukGrafik veriler={birikimTrendi} renk="#4A7C74" />
              </div>
            </div>
          )}

          {kategoriListesi.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">Son 6 Ayda En Çok Harcanan Kategoriler</h2>
              <div className="bg-white rounded-lg p-4 border border-border flex flex-col gap-2.5">
                {kategoriListesi.map((g) => (
                  <div key={g.kategori} className="flex items-center gap-3">
                    <span className="text-xs text-navy w-28 shrink-0 truncate" title={g.kategori}>{g.kategori}</span>
                    <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                      <div style={{ width: `${(g.tutar / enBuyukKategori) * 100}%`, backgroundColor: g.renk }} className="h-full rounded-full" />
                    </div>
                    <span className="font-mono text-xs text-muted w-24 text-right shrink-0">{g.tutar.toLocaleString('tr-TR')} ₺</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

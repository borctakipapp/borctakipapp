// ============================================================================
// OTOMATİK DOĞRULAMA — Özet (Dashboard) vs Gelir-Gider: Gider Dağılımı Tutarlılığı
// ============================================================================
// KÖK NEDEN (düzeltilen bug): giderKategorileriHesapla() Özet'te kullanılmaya
// başlandığında, "Birikimden Çekim" gelirini aynı ayki "Birikim Aktarımı"
// giderinden düşen netleme kuralı unutulmuştu. Gelir-Gider sayfası bu kuralı
// kendi inline kodunda hâlâ uyguluyordu — iki sayfa aynı ay için FARKLI
// "Birikim Aktarımı" tutarı gösteriyordu.
//
// DÜZELTME: Netleme kuralı artık giderKategorileriHesapla()'nın İÇİNDE, tek
// yerde. Bu script, DB'ye hiç dokunmadan (saf fonksiyon testi), Özet'in ve
// Gelir-Gider'in AYNI ham veri üzerinde AYNI TUTARLARI ürettiğini kanıtlar.
//
// ÇALIŞTIRMA:
//   npm install -D tsx   (bir kere)
//   npx tsx scripts/dogrula-gider-dagilimi-tutarliligi.ts
//
// GEREKSİNİM: Yok — saf fonksiyonları test ettiği için Supabase/env değişkeni
// gerekmez, gerçek veriye dokunmaz.
// ============================================================================

import { giderKategorileriHesapla, birikimdenCekimNetle, type Transaction } from '../lib/finans-motoru'

type SonucSatiri = { senaryo: string; basarili: boolean; detay: string }
const sonuclar: SonucSatiri[] = []

function kaydet(senaryo: string, basarili: boolean, detay: string) {
  sonuclar.push({ senaryo, basarili, detay })
  console.log(`${basarili ? '✅' : '❌'} ${senaryo}: ${detay}`)
}

const RENK_HARITASI: Record<string, string> = {
  'Market/Gıda': '#B5533C', 'Ulaşım': '#D98E3F', 'Eğlence': '#7f8ba0', 'Sağlık': '#1B2A4A',
  'Giyim': '#9c7ab5', 'Eğitim': '#4A7C74', 'Kişisel Bakım': '#c98a8a', 'Birikim Aktarımı': '#4A7C74',
  'Ortak Hesap': '#D9A441', 'Diğer Gider': '#6b6f7a',
}

function t(type: 'income' | 'expense', category: string, amount: number): Transaction {
  return { type, category, amount, transaction_date: '2026-07-15' }
}

// --- SENARYO 1: Özet (limit=5) ve Gelir-Gider (limit=Infinity) aynı netlenmiş
//     "Birikim Aktarımı" tutarını üretmeli ---
{
  const islemler: Transaction[] = [
    t('income', 'Maaş', 50000),
    t('income', 'Birikimden Çekim', 4000),
    t('expense', 'Birikim Aktarımı', 10000),
    t('expense', 'Market/Gıda', 3000),
  ]

  // Özet'in çağırdığı şekliyle (varsayılan limit=5)
  const ozetSonuc = giderKategorileriHesapla(islemler, RENK_HARITASI)
  // Gelir-Gider'in çağırdığı şekliyle (limit=Infinity, tüm liste)
  const gelirGiderSonuc = giderKategorileriHesapla(islemler, RENK_HARITASI, Infinity)

  const ozetBirikimAktarimi = ozetSonuc.liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar
  const ggBirikimAktarimi = gelirGiderSonuc.liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar
  const beklenenNetlenmisT = 10000 - 4000 // = 6000

  const dogru = ozetBirikimAktarimi === beklenenNetlenmisT && ggBirikimAktarimi === beklenenNetlenmisT
    && ozetBirikimAktarimi === ggBirikimAktarimi

  kaydet('1. Özet ve Gelir-Gider aynı netlenmiş tutarı üretiyor', dogru,
    `Özet=${ozetBirikimAktarimi} ₺, Gelir-Gider=${ggBirikimAktarimi} ₺ (beklenen: ${beklenenNetlenmisT} ₺, ikisi de eşit olmalı)`)
}

// --- SENARYO 2: birikimdenCekimNetle ile giderKategorileriHesapla AYNI netleme
//     miktarını kullanıyor (kural tekrar yazılmamış, tek kaynaktan besleniyor) ---
{
  const islemler: Transaction[] = [
    t('income', 'Birikimden Çekim', 2500),
    t('expense', 'Birikim Aktarımı', 2500),
    t('expense', 'Ulaşım', 800),
  ]

  const { birikimdenCekimToplami } = birikimdenCekimNetle(islemler)
  const { liste } = giderKategorileriHesapla(islemler, RENK_HARITASI, Infinity)
  const birikimAktarimiKalan = liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar || 0

  // Birikim Aktarımı tam netlendiği için (2500 - 2500 = 0), listede HİÇ görünmemeli (tutar>0 filtresi)
  const dogru = birikimdenCekimToplami === 2500 && birikimAktarimiKalan === 0
    && !liste.some((g) => g.kategori === 'Birikim Aktarımı')

  kaydet('2. Tam netleme (0\'a düşünce listeden düşüyor)', dogru,
    `birikimdenCekimToplami=${birikimdenCekimToplami} (beklenen 2500), Birikim Aktarımı listede=${liste.some((g) => g.kategori === 'Birikim Aktarımı') ? 'VAR (yanlış)' : 'yok (doğru)'}`)
}

// --- SENARYO 3: Özet'in limit=5 davranışı BOZULMADI (regresyon guard) ---
{
  const islemler: Transaction[] = [
    t('expense', 'Market/Gıda', 9000),
    t('expense', 'Ulaşım', 8000),
    t('expense', 'Eğlence', 7000),
    t('expense', 'Sağlık', 6000),
    t('expense', 'Giyim', 5000),
    t('expense', 'Eğitim', 4000),
    t('expense', 'Kişisel Bakım', 3000),
  ]
  const ozetSonuc = giderKategorileriHesapla(islemler, RENK_HARITASI) // limit varsayılan 5
  const gelirGiderSonuc = giderKategorileriHesapla(islemler, RENK_HARITASI, Infinity)

  const dogru = ozetSonuc.liste.length === 5 && gelirGiderSonuc.liste.length === 7
    && ozetSonuc.liste[0].kategori === 'Market/Gıda' // en büyük ilk sırada (sıralama bozulmadı)

  kaydet('3. Özet limit=5 ile sınırlı, Gelir-Gider tam liste (limit=Infinity)', dogru,
    `Özet liste uzunluğu=${ozetSonuc.liste.length} (beklenen 5), Gelir-Gider liste uzunluğu=${gelirGiderSonuc.liste.length} (beklenen 7), sıralama=${ozetSonuc.liste[0]?.kategori}`)
}

// --- SENARYO 4: Birikimden Çekim yokken davranış değişmiyor (regresyon guard) ---
{
  const islemler: Transaction[] = [
    t('income', 'Maaş', 30000),
    t('expense', 'Market/Gıda', 5000),
    t('expense', 'Birikim Aktarımı', 2000),
  ]
  const { liste } = giderKategorileriHesapla(islemler, RENK_HARITASI, Infinity)
  const birikimAktarimi = liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar

  const dogru = birikimAktarimi === 2000 // netlenecek "Birikimden Çekim" yok, tutar aynen kalmalı

  kaydet('4. Birikimden Çekim yokken netleme uygulanmıyor', dogru,
    `Birikim Aktarımı=${birikimAktarimi} (beklenen: 2000, değişmemeli)`)
}

// --- ÖZET ---
console.log('\n=== TEST ÖZETİ ===')
const basarisizlar = sonuclar.filter((s) => !s.basarili)
console.log(`${sonuclar.length - basarisizlar.length}/${sonuclar.length} senaryo başarılı`)
if (basarisizlar.length > 0) {
  console.log('\nBAŞARISIZ OLANLAR:')
  basarisizlar.forEach((s) => console.log(`  - ${s.senaryo}: ${s.detay}`))
  process.exitCode = 1
}
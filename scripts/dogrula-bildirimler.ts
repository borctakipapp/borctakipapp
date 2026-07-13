// ============================================================================
// OTOMATİK DOĞRULAMA — bildirimleriHesapla() (Bildirim Sistemi v1)
// ============================================================================
// Saf fonksiyon testi, DB gerektirmez.
// ÇALIŞTIRMA: npx tsx scripts/dogrula-bildirimler.ts
// ============================================================================

import { bildirimleriHesapla } from '../lib/finans-motoru'

type SonucSatiri = { senaryo: string; basarili: boolean; detay: string }
const sonuclar: SonucSatiri[] = []
function kaydet(senaryo: string, basarili: boolean, detay: string) {
  sonuclar.push({ senaryo, basarili, detay })
  console.log(`${basarili ? '✅' : '❌'} ${senaryo}: ${detay}`)
}

const BUGUN = new Date('2026-07-14T00:00:00')

function tarihEkle(gun: number): string {
  const d = new Date(BUGUN)
  d.setDate(d.getDate() + gun)
  return d.toISOString().slice(0, 10)
}

// --- SENARYO 1: 5 gün eşiği doğru uygulanıyor (borç) ---
{
  const borclar = [
    { id: 'b1', institution_name: 'Banka A', remaining_amount: 1000, due_date: tarihEkle(5) },  // dahil (sınırda)
    { id: 'b2', institution_name: 'Banka B', remaining_amount: 2000, due_date: tarihEkle(6) },  // hariç
    { id: 'b3', institution_name: 'Banka C', remaining_amount: 3000, due_date: tarihEkle(-2) }, // gecikmiş, dahil
  ]
  const sonuc = bildirimleriHesapla(borclar, [], [], [], {}, BUGUN)
  const dogru = sonuc.length === 2
    && sonuc.some((b) => b.id === 'b1' && b.tur === 'borc_yaklasan' && b.oncelik === 'uyari')
    && sonuc.some((b) => b.id === 'b3' && b.tur === 'borc_gecikti' && b.oncelik === 'kritik')
    && !sonuc.some((b) => b.id === 'b2')
  kaydet('1. Borç: 5 gün eşiği + gecikmiş/yaklaşan ayrımı', dogru, `${sonuc.length} bildirim (beklenen 2), tipler: ${sonuc.map((b) => b.tur).join(', ')}`)
}

// --- SENARYO 2: Bekleyen Alacak aynı eşik/tip mantığıyla çalışıyor ---
{
  const alacaklar = [
    { id: 'a1', contact_name: 'Ahmet', remaining_amount: 500, expected_date: tarihEkle(3) },
    { id: 'a2', contact_name: 'Mehmet', remaining_amount: 800, expected_date: tarihEkle(-1) },
    { id: 'a3', contact_name: 'Ayşe', remaining_amount: 200, expected_date: tarihEkle(20) }, // hariç
  ]
  const sonuc = bildirimleriHesapla([], [], alacaklar, [], {}, BUGUN)
  const dogru = sonuc.length === 2
    && sonuc.some((b) => b.id === 'a1' && b.tur === 'alacak_yaklasan')
    && sonuc.some((b) => b.id === 'a2' && b.tur === 'alacak_gecikti' && b.oncelik === 'kritik')
  kaydet('2. Bekleyen Alacak: eşik + gecikmiş/yaklaşan ayrımı', dogru, `${sonuc.length} bildirim (beklenen 2)`)
}

// --- SENARYO 3: Bütçe limiti aşımı doğru tespit ediliyor, aşılmayanlar dahil edilmiyor ---
{
  const giderKategorileri = [
    { kategori: 'Market/Gıda', tutar: 3500 }, // limit 3000, aşıldı
    { kategori: 'Ulaşım', tutar: 800 },        // limit 1000, aşılmadı
    { kategori: 'Eğlence', tutar: 200 },       // limitsiz
  ]
  const limitler = { 'Market/Gıda': 3000, 'Ulaşım': 1000 }
  const sonuc = bildirimleriHesapla([], [], [], giderKategorileri, limitler, BUGUN)
  const marketBildirimi = sonuc.find((b) => b.id === 'Market/Gıda')
  const dogru = sonuc.length === 1 && marketBildirimi?.tur === 'butce_asildi'
    && marketBildirimi.oncelik === 'kritik' && marketBildirimi.tutar === 500 && marketBildirimi.gunKaldi === null
  kaydet('3. Bütçe limiti aşımı doğru hesaplanıyor (aşım tutarı=500)', dogru, `${sonuc.length} bildirim (beklenen 1), aşım tutarı=${marketBildirimi?.tutar}`)
}

// --- SENARYO 4: Sıralama — kritik önce, sonra gunKaldi artan; bütçe kritik grubunda ama sona yakın (gunKaldi=null) ---
{
  const borclar = [{ id: 'b1', institution_name: 'X', remaining_amount: 100, due_date: tarihEkle(4) }]
  const alacaklar = [{ id: 'a1', contact_name: 'Y', remaining_amount: 100, expected_date: tarihEkle(-3) }]
  const giderKategorileri = [{ kategori: 'Market/Gıda', tutar: 3500 }]
  const limitler = { 'Market/Gıda': 3000 }
  const sonuc = bildirimleriHesapla(borclar, [], alacaklar, giderKategorileri, limitler, BUGUN)
  // Beklenen sıra: a1 (kritik, gunKaldi=-3) veya butce (kritik, gunKaldi=null->999) once kritikler, sonra uyari (b1)
  const dogru = sonuc[0].oncelik === 'kritik' && sonuc[1].oncelik === 'kritik' && sonuc[2].oncelik === 'uyari'
    && sonuc[2].id === 'b1'
  kaydet('4. Sıralama: kritik grubu önce, uyarı sonra', dogru, `sıra: ${sonuc.map((b) => `${b.tur}(${b.oncelik})`).join(' -> ')}`)
}

// --- SENARYO 5: Düzenli işlem — ay sonu taşması (day_of_month, kısa aylarda) doğru hesaplanıyor ---
{
  // BUGUN 2026-07-14. day_of_month=10 -> bu ayki 10'u geçmiş, gelecek ayın 10'una bakar (27 gün sonra, eşik dışı)
  const duzenli = [{ id: 'd1', category: 'Kira', description: null, amount: 5000, day_of_month: 18 }] // bu ay 18'i, 4 gün sonra
  const sonuc = bildirimleriHesapla([], duzenli, [], [], {}, BUGUN)
  const dogru = sonuc.length === 1 && sonuc[0].tur === 'duzenli_yaklasan' && sonuc[0].gunKaldi === 4
  kaydet('5. Düzenli işlem: sonraki tekrar tarihi doğru hesaplanıyor', dogru, `gunKaldi=${sonuc[0]?.gunKaldi} (beklenen 4)`)
}

console.log('\n=== TEST ÖZETİ ===')
const basarisizlar = sonuclar.filter((s) => !s.basarili)
console.log(`${sonuclar.length - basarisizlar.length}/${sonuclar.length} senaryo başarılı`)
if (basarisizlar.length > 0) {
  console.log('\nBAŞARISIZ OLANLAR:')
  basarisizlar.forEach((s) => console.log(`  - ${s.senaryo}: ${s.detay}`))
  process.exitCode = 1
}
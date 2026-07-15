import { describe, it, expect } from 'vitest'
import {
  sonrakiTarihHesapla, bildirimleriHesapla, abonelikToplamiHesapla,
  giderKategorileriHesapla, faizOraniTahminEt, amortismanSimuleEt,
  ayAraligiUret, ayKirilimiHesapla, aylikBirikimNetiHesapla, saglikSkoruHesapla,
} from './finans-motoru'

const BUGUN = new Date('2026-07-14T00:00:00')

// ============================================================================
// abonelikToplamiHesapla / sonrakiTarihHesapla (yıllık döngü) / bildirimleriHesapla
// (özel eşik) — önceden scripts/dogrula-abonelik.ts
// ============================================================================
describe('Abonelik Takibi', () => {
  it('aylık döngü (parametresiz, eski çağrı şekli) değişmedi', () => {
    const tarih = sonrakiTarihHesapla(18, BUGUN)
    expect(tarih.getFullYear()).toBe(2026)
    expect(tarih.getMonth()).toBe(6)
    expect(tarih.getDate()).toBe(18)
  })

  it('yıllık döngü — bu yıl içindeki gelecek ay', () => {
    const tarih = sonrakiTarihHesapla(20, BUGUN, 'yillik', 11)
    expect(tarih.getFullYear()).toBe(2026)
    expect(tarih.getMonth()).toBe(10)
    expect(tarih.getDate()).toBe(20)
  })

  it('yıllık döngü — geçmiş ay, gelecek yıla sarkma', () => {
    const tarih = sonrakiTarihHesapla(15, BUGUN, 'yillik', 3)
    expect(tarih.getFullYear()).toBe(2027)
    expect(tarih.getMonth()).toBe(2)
    expect(tarih.getDate()).toBe(15)
  })

  it('abonelik özel iptal_hatirlatma_gun eşiği genel eşiği eziyor', () => {
    const duzenli = [{
      id: 'a1', category: 'Eğlence', description: null, amount: 199.99, day_of_month: 22,
      abonelik_mi: true, saglayici_adi: 'Netflix', fatura_dongusu: 'aylik' as const, iptal_hatirlatma_gun: 10,
    }]
    const sonuc = bildirimleriHesapla([], duzenli, [], [], {}, BUGUN)
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0].baslik).toBe('Netflix')
    expect(sonuc[0].gunKaldi).toBe(8)
  })

  it('abonelik olmayan düzenli işlem (alanlar opsiyonel) hâlâ çalışıyor', () => {
    const duzenli = [{ id: 'd1', category: 'Kira', description: null, amount: 5000, day_of_month: 18 }]
    const sonuc = bildirimleriHesapla([], duzenli, [], [], {}, BUGUN)
    expect(sonuc[0].baslik).toBe('Kira')
    expect(sonuc[0].gunKaldi).toBe(4)
  })

  it('aylık eşdeğer toplam doğru (yıllık/12, pasif hariç)', () => {
    const abonelikler = [
      { id: 'a1', amount: 199.99, active: true, fatura_dongusu: 'aylik' as const },
      { id: 'a2', amount: 1200, active: true, fatura_dongusu: 'yillik' as const },
      { id: 'a3', amount: 500, active: false, fatura_dongusu: 'aylik' as const },
    ]
    expect(abonelikToplamiHesapla(abonelikler)).toBeCloseTo(299.99, 2)
  })

  it('vergi/harç kaydı da abonelik gibi saglayici_adi ile başlıklandırılıyor', () => {
    const duzenli = [{
      id: 'v1', category: 'Vergi/Harç', description: null, amount: 850, day_of_month: 31,
      vergi_harc_mi: true, saglayici_adi: 'MTV', fatura_dongusu: 'yillik' as const, fatura_ay: 1,
    }]
    const sonuc = bildirimleriHesapla([], duzenli, [], [], {}, new Date('2027-01-28T00:00:00'))
    expect(sonuc[0].baslik).toBe('MTV')
  })
})

// ============================================================================
// bildirimleriHesapla — genel (önceden scripts/dogrula-bildirimler.ts)
// ============================================================================
describe('Bildirim Sistemi v1', () => {
  // NOT: .toISOString() KULLANILMIYOR — UTC'ye çevirip geri okumak, UTC dışındaki
  // zaman dilimlerinde (örn. Türkiye, UTC+3) tarihi bir gün kaydırabiliyordu (bu test
  // dosyasının kendisinde yakalanan bir hataydı, gerçek uygulama kodunda böyle bir
  // dönüşüm hiç yok). Yerel tarih bileşenleriyle (getFullYear/getMonth/getDate)
  // oluşturmak, hangi zaman diliminde çalıştırılırsa çalıştırılsın aynı sonucu verir.
  const ikiBasamakli = (n: number) => String(n).padStart(2, '0')
  const tarihEkle = (gun: number) => {
    const d = new Date(BUGUN); d.setDate(d.getDate() + gun)
    return `${d.getFullYear()}-${ikiBasamakli(d.getMonth() + 1)}-${ikiBasamakli(d.getDate())}`
  }

  it('borç: 5 gün eşiği + gecikmiş/yaklaşan ayrımı', () => {
    const borclar = [
      { id: 'b1', institution_name: 'Banka A', remaining_amount: 1000, due_date: tarihEkle(5) },
      { id: 'b2', institution_name: 'Banka B', remaining_amount: 2000, due_date: tarihEkle(6) },
      { id: 'b3', institution_name: 'Banka C', remaining_amount: 3000, due_date: tarihEkle(-2) },
    ]
    const sonuc = bildirimleriHesapla(borclar, [], [], [], {}, BUGUN)
    expect(sonuc).toHaveLength(2)
    expect(sonuc.find((b) => b.id === 'b1')?.tur).toBe('borc_yaklasan')
    expect(sonuc.find((b) => b.id === 'b3')?.tur).toBe('borc_gecikti')
  })

  it('bekleyen alacak: eşik + gecikmiş/yaklaşan ayrımı', () => {
    const alacaklar = [
      { id: 'a1', contact_name: 'Ahmet', remaining_amount: 500, expected_date: tarihEkle(3) },
      { id: 'a2', contact_name: 'Mehmet', remaining_amount: 800, expected_date: tarihEkle(-1) },
      { id: 'a3', contact_name: 'Ayşe', remaining_amount: 200, expected_date: tarihEkle(20) },
    ]
    const sonuc = bildirimleriHesapla([], [], alacaklar, [], {}, BUGUN)
    expect(sonuc).toHaveLength(2)
    expect(sonuc.find((b) => b.id === 'a2')?.oncelik).toBe('kritik')
  })

  it('bütçe limiti aşımı doğru hesaplanıyor', () => {
    const giderKategorileri = [{ kategori: 'Market/Gıda', tutar: 3500 }, { kategori: 'Ulaşım', tutar: 800 }]
    const limitler = { 'Market/Gıda': 3000, 'Ulaşım': 1000 }
    const sonuc = bildirimleriHesapla([], [], [], giderKategorileri, limitler, BUGUN)
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0].tutar).toBe(500)
    expect(sonuc[0].gunKaldi).toBeNull()
  })

  it('sıralama: kritik grubu önce, uyarı sonra', () => {
    const borclar = [{ id: 'b1', institution_name: 'X', remaining_amount: 100, due_date: tarihEkle(4) }]
    const alacaklar = [{ id: 'a1', contact_name: 'Y', remaining_amount: 100, expected_date: tarihEkle(-3) }]
    const sonuc = bildirimleriHesapla(borclar, [], alacaklar, [], {}, BUGUN)
    expect(sonuc[0].oncelik).toBe('kritik')
    expect(sonuc[1].oncelik).toBe('uyari')
  })
})

// ============================================================================
// giderKategorileriHesapla (netleme kuralı) — önceden
// scripts/dogrula-gider-dagilimi-tutarliligi.ts
// ============================================================================
describe('Gider Dağılımı Netleme (P0)', () => {
  const RENK: Record<string, string> = { 'Birikim Aktarımı': '#4A7C74', 'Market/Gıda': '#B5533C' }
  const t = (type: 'income' | 'expense', category: string, amount: number) => ({ type, category, amount, transaction_date: '2026-07-15' })

  it('Özet ve Gelir-Gider aynı netlenmiş tutarı üretiyor', () => {
    const islemler = [t('income', 'Maaş', 50000), t('income', 'Birikimden Çekim', 4000), t('expense', 'Birikim Aktarımı', 10000), t('expense', 'Market/Gıda', 3000)]
    const ozet = giderKategorileriHesapla(islemler, RENK)
    const gelirGider = giderKategorileriHesapla(islemler, RENK, Infinity)
    const ozetTutar = ozet.liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar
    const ggTutar = gelirGider.liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar
    expect(ozetTutar).toBe(6000)
    expect(ozetTutar).toBe(ggTutar)
  })

  it('tam netleme (0\'a düşünce listeden düşüyor)', () => {
    const islemler = [t('income', 'Birikimden Çekim', 2500), t('expense', 'Birikim Aktarımı', 2500)]
    const { liste } = giderKategorileriHesapla(islemler, RENK, Infinity)
    expect(liste.some((g) => g.kategori === 'Birikim Aktarımı')).toBe(false)
  })

  it('limit=5 ile sınırlı, limit=Infinity tam liste', () => {
    const kategoriler = ['Market/Gıda', 'Ulaşım', 'Eğlence', 'Sağlık', 'Giyim', 'Eğitim', 'Kişisel Bakım']
    const islemler = kategoriler.map((k, i) => t('expense', k, 9000 - i * 1000))
    const ozet = giderKategorileriHesapla(islemler, RENK)
    const tam = giderKategorileriHesapla(islemler, RENK, Infinity)
    expect(ozet.liste).toHaveLength(5)
    expect(tam.liste).toHaveLength(7)
  })

  it('Birikimden Çekim yokken netleme uygulanmıyor', () => {
    const islemler = [t('income', 'Maaş', 30000), t('expense', 'Birikim Aktarımı', 2000)]
    const { liste } = giderKategorileriHesapla(islemler, RENK, Infinity)
    expect(liste.find((g) => g.kategori === 'Birikim Aktarımı')?.tutar).toBe(2000)
  })
})

// ============================================================================
// faizOraniTahminEt — önceden scripts/dogrula-faiz-orani.ts
// ============================================================================
describe('Kredi Faiz Oranı Tahmini', () => {
  it('kullanıcı örneği: 200k->250k, 36 taksit', () => {
    const r = faizOraniTahminEt({ anapara: 200000, taksitTutari: 250000 / 36, taksitSayisi: 36 })
    expect(r).not.toBeNull()
    expect(r! * 100).toBeCloseTo(1.26, 1)
  })

  it('round-trip: bulunan oranla simülasyon aynı ay sayısına ulaşıyor', () => {
    const anapara = 150000, taksitSayisi = 24, taksitTutari = 7500
    const r = faizOraniTahminEt({ anapara, taksitTutari, taksitSayisi })!
    const sim = amortismanSimuleEt({ kalanAnapara: anapara, aylikFaizOrani: r, aylikTaksitTutari: taksitTutari })
    expect(sim.gecersiz).toBe(false)
    expect(Math.abs(sim.aySayisi - taksitSayisi)).toBeLessThanOrEqual(1)
  })

  it('faizsiz eşit bölüme eşit taksit -> çözüm yok (null)', () => {
    expect(faizOraniTahminEt({ anapara: 120000, taksitTutari: 10000, taksitSayisi: 12 })).toBeNull()
  })

  it('geçersiz girdiler null dönüyor', () => {
    expect(faizOraniTahminEt({ anapara: 0, taksitTutari: 100, taksitSayisi: 12 })).toBeNull()
    expect(faizOraniTahminEt({ anapara: 1000, taksitTutari: -50, taksitSayisi: 12 })).toBeNull()
  })
})

// ============================================================================
// Raporlar — ayAraligiUret + aylikBirikimNetiHesapla — önceden scripts/dogrula-raporlar.ts
// ============================================================================
describe('Raporlar — Birikim Trendi', () => {
  it('aynı ay içi add-remove neti', () => {
    const entries = [
      { amount: 1000, type: 'add', created_at: '2026-07-05T10:00:00+00:00' },
      { amount: 300, type: 'remove', created_at: '2026-07-20T15:30:00+00:00' },
    ]
    expect(aylikBirikimNetiHesapla(entries, '2026-07-01', '2026-08-01')).toBe(700)
  })

  it('ay sınırları doğru (bir önceki/sonraki ay hariç)', () => {
    const entries = [
      { amount: 500, type: 'add', created_at: '2026-06-30T23:59:59+00:00' },
      { amount: 200, type: 'add', created_at: '2026-07-01T00:00:00+00:00' },
      { amount: 100, type: 'add', created_at: '2026-08-01T00:00:00+00:00' },
    ]
    expect(aylikBirikimNetiHesapla(entries, '2026-07-01', '2026-08-01')).toBe(200)
  })

  it('6 aylık döngü toplamı doğru', () => {
    const entries = [
      { amount: 1000, type: 'add', created_at: '2026-03-15T00:00:00+00:00' },
      { amount: 2000, type: 'add', created_at: '2026-05-10T00:00:00+00:00' },
      { amount: 500, type: 'remove', created_at: '2026-05-20T00:00:00+00:00' },
    ]
    let toplam = 0
    for (let i = 5; i >= 0; i--) {
      const aralik = ayAraligiUret(2026, 6, i)
      toplam += aylikBirikimNetiHesapla(entries, aralik.baslangic, aralik.bitis)
    }
    expect(toplam).toBe(2500)
  })

  it('ayKirilimiHesapla ile borcOdeme trendi doğru okunuyor', () => {
    const tx = [{ type: 'income' as const, category: 'Maaş', amount: 30000, transaction_date: '2026-07-05' }]
    const payments = [{ amount: 2000, paid_at: '2026-07-10T00:00:00+00:00' }]
    const aralik = ayAraligiUret(2026, 6, 0)
    const kirilim = ayKirilimiHesapla(tx, payments, aralik.baslangic, aralik.bitis)
    expect(kirilim.borcOdeme).toBe(2000)
    expect(kirilim.gelir).toBe(30000)
  })
})

// ============================================================================
// saglikSkoruHesapla — önceden scripts/dogrula-saglik-skoru.ts
// ============================================================================
describe('Finansal Sağlık Skoru', () => {
  it('hiç veri yokken skor 100', () => {
    const sonuc = saglikSkoruHesapla({ borcGelirOrani: null, gecikenSayisi: 0, buAyNet: 0, toplamBirikim: 0, hicVeriYokMu: true })
    expect(sonuc.skor).toBe(100)
  })

  it('hicVeriYokMu verilmezse eski davranış korunuyor (geriye uyumlu)', () => {
    const sonuc = saglikSkoruHesapla({ borcGelirOrani: null, gecikenSayisi: 0, buAyNet: 0, toplamBirikim: 0 })
    expect(sonuc.skor).toBe(65)
  })

  it('gerçekten iyi finansal durum kısayoldan değil, hak ederek 100 alıyor', () => {
    const sonuc = saglikSkoruHesapla({ borcGelirOrani: 0.15, gecikenSayisi: 0, buAyNet: 500, toplamBirikim: 1000, hicVeriYokMu: false })
    expect(sonuc.skor).toBe(100)
    expect(sonuc.nedenler).toHaveLength(0)
  })

  it('gerçekten kötü durum hâlâ düşük skor veriyor (kısayol karışmıyor)', () => {
    const sonuc = saglikSkoruHesapla({ borcGelirOrani: 0.6, gecikenSayisi: 2, buAyNet: -500, toplamBirikim: 0, hicVeriYokMu: false })
    expect(sonuc.skor).toBe(0)
  })
})

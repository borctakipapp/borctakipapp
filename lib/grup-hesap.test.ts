import { describe, it, expect } from 'vitest'
import { bakiyeHesapla } from './grup-hesap'

describe('Ortak Hesap — Grup Listesi Bakiyesi', () => {
  it('tek kişilik uyeler dizisiyle doğru net hesaplanıyor (gruplar/page.tsx deseni)', () => {
    const harcamalar = [{ odeyen_id: 'ben', tutar: 300 }, { odeyen_id: 'arkadas', tutar: 0 }]
    const bolusumler = [{ user_id: 'ben', pay_tutari: 100 }, { user_id: 'arkadas', pay_tutari: 200 }]
    const sonuc = bakiyeHesapla(harcamalar, bolusumler, [], [{ user_id: 'ben', ad_soyad: '' }])
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0].net).toBe(200)
  })

  it('detay sayfası (tam üye listesi) ve liste sayfası (tek kişilik) AYNI neti veriyor', () => {
    const uyeler = [{ user_id: 'ben', ad_soyad: 'Ben' }, { user_id: 'ayse', ad_soyad: 'Ayşe' }, { user_id: 'mehmet', ad_soyad: 'Mehmet' }]
    const harcamalar = [{ odeyen_id: 'ben', tutar: 150 }]
    const bolusumler = uyeler.map((u) => ({ user_id: u.user_id, pay_tutari: 50 }))
    const odemeler = [{ odeyen_id: 'ayse', alan_id: 'ben', tutar: 30 }]

    const detay = bakiyeHesapla(harcamalar, bolusumler, odemeler, uyeler).find((b) => b.userId === 'ben')!.net
    const liste = bakiyeHesapla(harcamalar, bolusumler, odemeler, [{ user_id: 'ben', ad_soyad: '' }])[0].net

    expect(detay).toBe(liste)
  })

  it('bir ödeme, ödemeyle ilgisi olmayan üçüncü kişinin net bakiyesini DEĞİŞTİRMİYOR', () => {
    const uyeler = [{ user_id: 'A', ad_soyad: 'A' }, { user_id: 'B', ad_soyad: 'B' }, { user_id: 'C', ad_soyad: 'C' }]
    const harcamalar = [{ odeyen_id: 'A', tutar: 300 }]
    const bolusumler = uyeler.map((u) => ({ user_id: u.user_id, pay_tutari: 100 }))

    const oncekiNet = bakiyeHesapla(harcamalar, bolusumler, [], uyeler).find((b) => b.userId === 'C')!.net
    // B, A'ya ödeme yapıyor — C'nin bununla hiç ilgisi yok
    const odemeler = [{ odeyen_id: 'B', alan_id: 'A', tutar: 100 }]
    const sonrakiNet = bakiyeHesapla(harcamalar, bolusumler, odemeler, uyeler).find((b) => b.userId === 'C')!.net

    expect(sonrakiNet).toBe(oncekiNet)
  })
})

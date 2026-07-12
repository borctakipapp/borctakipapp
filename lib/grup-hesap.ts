// Grup harcama bölüşümü — bakiye ve mutabakat (settle-up) hesaplama.
// Algoritma: her üyenin net bakiyesini bulur (alacaklıysa +, borçluysa -),
// sonra en büyük borçluyu en büyük alacaklıyla eşleştirerek MİNİMUM sayıda
// öneri üretir (klasik "debt simplification" tekniği — Splitwise'ın da kullandığı yöntem).

export type UyeBakiye = { userId: string; adSoyad: string; net: number }
export type OdemeOnerisi = { borcluId: string; borcluAd: string; alacakliId: string; alacakliAd: string; tutar: number }

export function bakiyeHesapla(
  harcamalar: { odeyen_id: string; tutar: number }[],
  bolusumler: { user_id: string; pay_tutari: number }[],
  odemeler: { odeyen_id: string; alan_id: string; tutar: number }[],
  uyeler: { user_id: string; ad_soyad: string | null }[]
): UyeBakiye[] {
  const net: Record<string, number> = {}
  uyeler.forEach((u) => { net[u.user_id] = 0 })

  harcamalar.forEach((h) => {
    net[h.odeyen_id] = (net[h.odeyen_id] || 0) + Number(h.tutar)
  })
  bolusumler.forEach((b) => {
    net[b.user_id] = (net[b.user_id] || 0) - Number(b.pay_tutari)
  })
  odemeler.forEach((o) => {
    net[o.odeyen_id] = (net[o.odeyen_id] || 0) + Number(o.tutar)
    net[o.alan_id] = (net[o.alan_id] || 0) - Number(o.tutar)
  })

  return uyeler.map((u) => ({
    userId: u.user_id,
    adSoyad: u.ad_soyad || 'Bilinmeyen',
    net: Math.round((net[u.user_id] || 0) * 100) / 100,
  }))
}

export function mutabakatOner(bakiyeler: UyeBakiye[]): OdemeOnerisi[] {
  const alacaklilar = bakiyeler.filter((b) => b.net > 0.5).map((b) => ({ ...b })).sort((a, b) => b.net - a.net)
  const borclular = bakiyeler.filter((b) => b.net < -0.5).map((b) => ({ ...b, net: -b.net })).sort((a, b) => b.net - a.net)

  const oneriler: OdemeOnerisi[] = []
  let i = 0
  let j = 0
  while (i < borclular.length && j < alacaklilar.length) {
    const tutar = Math.min(borclular[i].net, alacaklilar[j].net)
    if (tutar > 0.5) {
      oneriler.push({
        borcluId: borclular[i].userId,
        borcluAd: borclular[i].adSoyad,
        alacakliId: alacaklilar[j].userId,
        alacakliAd: alacaklilar[j].adSoyad,
        tutar: Math.round(tutar * 100) / 100,
      })
    }
    borclular[i].net -= tutar
    alacaklilar[j].net -= tutar
    if (borclular[i].net < 0.5) i++
    if (alacaklilar[j].net < 0.5) j++
  }
  return oneriler
}

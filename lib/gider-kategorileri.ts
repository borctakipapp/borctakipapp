// Gider kategorisi -> renk eşlemesi. Önceden Özet ve Gelir-Gider sayfalarında ayrı ayrı
// tanımlıydı (birebir aynı içerikle) — Raporlar sayfası eklenirken üçüncü bir kopya
// açmak yerine buraya taşındı, üç yer de artık buradan okuyor.
export const GIDER_KATEGORI_RENK: Record<string, string> = {
  'Market/Gıda': '#B5533C', 'Ulaşım': '#D98E3F', 'Eğlence': '#7f8ba0', 'Sağlık': '#1B2A4A',
  'Giyim': '#9c7ab5', 'Eğitim': '#4A7C74', 'Kişisel Bakım': '#c98a8a', 'Birikim Aktarımı': '#4A7C74',
  'Ortak Hesap': '#D9A441', 'Diğer Gider': '#6b6f7a',
}

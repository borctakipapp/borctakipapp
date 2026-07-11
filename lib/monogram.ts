// Gerçek marka logoları/renkleri kullanmıyoruz (hukuki risk) — isimden deterministik,
// her zaman aynı sonucu veren bir renk üretiyoruz. Aynı kurum/kişi adı hep aynı rengi alır.

const RENK_PALETI = [
  '#B5533C', // tuğla
  '#4A7C74', // çam yeşili
  '#D98E3F', // amber
  '#5B7FA6', // mavi
  '#8B6BA8', // mor
  '#6B8E4E', // zeytin yeşili
  '#C77B8E', // pembe-kırmızı
  '#4A6670', // petrol mavisi
]

export function monogramRengi(isim: string): string {
  if (!isim) return RENK_PALETI[0]
  let hash = 0
  for (let i = 0; i < isim.length; i++) {
    hash = isim.charCodeAt(i) + ((hash << 5) - hash)
  }
  return RENK_PALETI[Math.abs(hash) % RENK_PALETI.length]
}

export function monogramHarfi(isim: string): string {
  if (!isim) return '?'
  return isim.trim().charAt(0).toLocaleUpperCase('tr-TR')
}
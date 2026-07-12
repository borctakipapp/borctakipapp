// Türkiye IBAN formatı: TR + 24 rakam (toplam 26 karakter). Basit format kontrolü — banka nezdinde
// gerçek doğrulama (checksum) yapmıyoruz, sadece "doğru şekilde girilmiş mi" kontrolü.

export function ibanTemizle(deger: string): string {
  return deger.replace(/\s/g, '').toUpperCase()
}

export function ibanFormatla(deger: string): string {
  const temiz = ibanTemizle(deger)
  return temiz.match(/.{1,4}/g)?.join(' ') || temiz
}

export function ibanGecerliMi(deger: string): boolean {
  const temiz = ibanTemizle(deger)
  return /^TR\d{24}$/.test(temiz)
}

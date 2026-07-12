// Ham Supabase/Postgres hata metinlerini kullanıcının anlayacağı Türkçe'ye çeviriyor.
// Hiçbir yerde ham error.message kullanıcıya doğrudan gösterilmemeli — hep bu fonksiyondan geçmeli.
export function hataMesajiCevir(error: unknown): string {
  const mesaj = (error as { message?: string })?.message || ''
  const kucuk = mesaj.toLowerCase()

  if (kucuk.includes('duplicate key') || kucuk.includes('already exists')) {
    return 'Bu kayıt zaten mevcut.'
  }
  if (kucuk.includes('violates foreign key')) {
    return 'İlgili kayıt bulunamadı — sayfayı yenileyip tekrar dener misin?'
  }
  if (kucuk.includes('violates row-level security') || kucuk.includes('permission denied')) {
    return 'Bu işlem için yetkin yok.'
  }
  if (kucuk.includes('network') || kucuk.includes('fetch failed') || kucuk.includes('failed to fetch')) {
    return 'İnternet bağlantında bir sorun var. Bağlantını kontrol edip tekrar dener misin?'
  }
  if (kucuk.includes('jwt') || kucuk.includes('session') || kucuk.includes('not authenticated')) {
    return 'Oturumun sona ermiş olabilir. Sayfayı yenileyip tekrar giriş yapmayı dener misin?'
  }
  if (kucuk.includes('violates check constraint') || kucuk.includes('invalid input')) {
    return 'Girdiğin bilgilerden biri geçersiz görünüyor, kontrol edip tekrar dener misin?'
  }
  if (!mesaj) {
    return 'Bir şeyler ters gitti. Lütfen tekrar dene.'
  }
  return 'Bir şeyler ters gitti, işlemin tamamlanamadı. Lütfen tekrar dene — sorun devam ederse birkaç dakika sonra tekrar dene.'
}

// ============================================================================
// BORÇ KATEGORİLERİ — Tek Kaynak
// ============================================================================
// Kategori listesi, etiketleri ve renkleri önceden 3 farklı dosyada (BorcEkleModal,
// BorcDetayModal, borclar/page.tsx, admin kullanıcı detay) ayrı ayrı tanımlıydı.
// Artık hepsi buradan okunuyor — yeni bir kategori eklemek istediğinde SADECE bu
// dosyayı değiştirmen yeterli.
// ============================================================================

export const BORC_KATEGORILERI = [
  { value: 'kredi_karti', label: 'Kredi Kartı' },
  { value: 'kmh', label: 'KMH (Kredili Mevduat Hesabı)' },
  { value: 'ihtiyac_kredisi', label: 'İhtiyaç Kredisi' },
  { value: 'konut_kredisi', label: 'Konut Kredisi' },
  { value: 'tasit_kredisi', label: 'Taşıt Kredisi' },
  { value: 'kisisel', label: 'Kişisel Borç' },
  { value: 'taksitli_alisveris', label: 'Taksitli Alışveriş' },
  { value: 'diger', label: 'Diğer' },
] as const

export const BORC_KATEGORI_ETIKET: Record<string, string> = Object.fromEntries(
  BORC_KATEGORILERI.map((k) => [k.value, k.label])
)

export const BORC_KATEGORI_RENK: Record<string, string> = {
  kredi_karti: '#B5533C',
  kmh: '#8B4A9C',
  ihtiyac_kredisi: '#D98E3F',
  konut_kredisi: '#1B2A4A',
  tasit_kredisi: '#5B7FA6',
  kisisel: '#C77B8E',
  taksitli_alisveris: '#6B8E4E',
  diger: '#6b6f7a',
}

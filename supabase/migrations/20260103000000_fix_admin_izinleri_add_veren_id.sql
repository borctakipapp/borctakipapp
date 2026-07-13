-- ============================================================================
-- BUG FIX (2/2) — admin_izinleri: eksik veren_id kolonu + izin CHECK kısıtı
-- ============================================================================
-- BULGU: Önceki migration (20260102000000) admin_izinleri tablosunu kod
-- tabanının SELECT/DELETE kullanım şekline bakarak oluşturmuştu, ama gerçek
-- INSERT şeklini (lib/admin-yetki-actions.ts satır 22) kaçırmıştı:
--   { user_id: hedefUserId, izin, veren_id: user.id }
-- Canlıda ilk gerçek kullanımda hata verdi: "Could not find the 'veren_id'
-- column of 'admin_izinleri' in the schema cache". Tablo bu hatadan dolayı
-- hâlâ boş (hiç satır insert edilemedi) — bu ALTER TABLE veri kaybı riski
-- taşımıyor.
--
-- Ayrıca lib/admin-auth.ts'deki TUM_YETKILER sabitinden görülen gerçek `izin`
-- değerleri artık netleşti, CHECK kısıtı ekleniyor.
-- ============================================================================

ALTER TABLE public.admin_izinleri
  ADD COLUMN veren_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE public.admin_izinleri
  ADD CONSTRAINT admin_izinleri_izin_check
  CHECK (izin = ANY (ARRAY[
    'kullanici_goruntule'::text,
    'kullanici_duzenle'::text,
    'kullanici_sil'::text,
    'veri_mudahale'::text,
    'yetki_yonetimi'::text
  ]));

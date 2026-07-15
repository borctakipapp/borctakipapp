-- ============================================================================
-- FEATURE — Abonelik Takibi: recurring_items'a genişletme kolonları
-- ============================================================================
-- Abonelikler ayrı bir tablo DEĞİL — recurring_items'ın özel bir alt tipi.
-- Bu, debts tablosunun KMH/taksitli kredi için zaten kullandığı desenle aynı
-- (nullable ek kolonlar, ayrı tablo yok). Böylece Bildirim Sistemi'nin
-- recurring_items üzerinde çalışan mevcut mantığı, abonelikleri de otomatik
-- kapsar — kural iki yerde yazılmıyor.
-- ============================================================================

ALTER TABLE public.recurring_items
  ADD COLUMN abonelik_mi boolean NOT NULL DEFAULT false,
  ADD COLUMN saglayici_adi text,
  ADD COLUMN fatura_dongusu text NOT NULL DEFAULT 'aylik',
  ADD COLUMN fatura_ay integer,
  ADD COLUMN iptal_hatirlatma_gun integer;

ALTER TABLE public.recurring_items
  ADD CONSTRAINT recurring_items_fatura_dongusu_check
  CHECK (fatura_dongusu = ANY (ARRAY['aylik'::text, 'yillik'::text]));

ALTER TABLE public.recurring_items
  ADD CONSTRAINT recurring_items_fatura_ay_check
  CHECK (fatura_ay IS NULL OR (fatura_ay >= 1 AND fatura_ay <= 12));

-- Sadece yıllık döngüde fatura_ay dolu olmalı, aylıkta null kalmalı (uygulama
-- katmanında zaten böyle yazılacak, burada DB seviyesinde de garanti altına
-- alınıyor — "aynı kural iki yerde" değil, aynı kuralın hem DB hem TS
-- tarafında AYNI şekilde ifade edilmesi, savunma amaçlı çift katman).
ALTER TABLE public.recurring_items
  ADD CONSTRAINT recurring_items_fatura_ay_tutarlilik_check
  CHECK (
    (fatura_dongusu = 'aylik' AND fatura_ay IS NULL)
    OR (fatura_dongusu = 'yillik' AND fatura_ay IS NOT NULL)
  );

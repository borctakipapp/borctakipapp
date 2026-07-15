-- ============================================================================
-- FEATURE — Vergi/Harç Hatırlatıcıları: recurring_items'a genişletme kolonu
-- ============================================================================
-- Abonelik Takibi ile AYNI mimari desen: ayrı tablo değil, recurring_items'ın
-- özel bir alt tipi (debts'in KMH/taksitli kredi için kullandığı desenle aynı).
-- Mevcut kolonlar (saglayici_adi, fatura_dongusu, fatura_ay, iptal_hatirlatma_gun)
-- olduğu gibi yeniden kullanılıyor — sadece ayırt edici yeni bir bayrak kolonu
-- gerekiyor.
--
-- NOT: Üçüncü benzer bayrak eklenirse (abonelik_mi, vergi_harc_mi, ...+1),
-- bunları tek bir `tur` (text) kolonuna genelleştirmeyi düşün — şimdilik iki
-- bayrak için ayrı ayrı tutmak daha basit ve mevcut sorguları bozmuyor.
-- ============================================================================

ALTER TABLE public.recurring_items
  ADD COLUMN vergi_harc_mi boolean NOT NULL DEFAULT false;

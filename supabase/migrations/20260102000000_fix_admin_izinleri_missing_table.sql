-- ============================================================================
-- BUG FIX — admin_izinleri tablosu eksikti
-- ============================================================================
-- BULGU (2026-07-14, migration envanteri çıkarılırken keşfedildi): Kod tabanı
-- (lib/admin-auth.ts, lib/admin-yetki-actions.ts) `admin_izinleri` tablosuna
-- SELECT/INSERT/DELETE yapıyor, ama bu tablo canlı veritabanının HİÇBİR
-- şemasında yok — information_schema.tables sorgusu 0 satır döndürdü,
-- doğrulandı.
--
-- ETKİ: `izinKontrolEt` (yetki kontrolü) her çağrıldığında hata alıyor olmalı;
-- `.maybeSingle()` kullanıldığı için bu muhtemelen "yetki yok" olarak
-- yorumlanıyor (fail-closed, güvenli taraf) ama kesin doğrulanmadı. Yetki
-- ATAMA tarafı (lib/admin-yetki-actions.ts) da aynı şekilde hata alıyor
-- olmalı — yani KURUCU HESAP DIŞINDA hiçbir admin'e özel/kısıtlı yetki
-- atanamıyor olabilir. Bu migration'ı uyguladıktan sonra admin panelinde
-- gerçek bir yetki atama/kontrol akışını UÇTAN UCA test etmen gerekiyor —
-- bu dosya sadece tabloyu var eder, önceden hiç çalışmamış bir özelliğin
-- ilk kez gerçekten çalıştığından emin olmak ayrı bir doğrulama gerektirir.
--
-- Kod tabanındaki kullanım şekline göre çıkarılan şema (kesin DB kaynağı
-- olmadığı için tahmin edilen kısımlar var — ör. `izin` kolonunun olası
-- değerleri kod tarafında sabit bir liste olarak bulunamadı, bu yüzden CHECK
-- kısıtı EKLEMEDİM, serbest text bıraktım):
--   .select('id').eq('user_id', ...).eq('izin', ...)   -> user_id, izin
--   .select('izin').eq('user_id', userId)               -> user_id, izin
--   .insert(kayitlar)                                    -> çoklu (user_id, izin) satırı
--   .delete().eq('user_id', hedefUserId)                 -> tüm yetkileri temizleme
-- ============================================================================

CREATE TABLE public.admin_izinleri (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  izin text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT admin_izinleri_pkey PRIMARY KEY (id),
  CONSTRAINT admin_izinleri_user_id_izin_key UNIQUE (user_id, izin)
);

ALTER TABLE public.admin_izinleri ENABLE ROW LEVEL SECURITY;

-- Bu tabloya normal kullanıcı erişimi olmamalı — sadece admin işlemleri
-- (lib/admin-yetki-actions.ts, service-role/admin client ile) yazıyor,
-- lib/admin-auth.ts ise normal client ile OKUYOR (izinKontrolEt). Okuma
-- policy'si: kullanıcı sadece KENDİ yetki satırlarını görebilir. Yazma
-- (insert/delete) tarafı admin-yetki-actions.ts'de zaten `admin` (service
-- role) client kullanıyor gibi görünüyor — eğer öyleyse RLS'i zaten bypass
-- ediyordur, bu policy sadece normal kullanıcı SELECT'i için gerekli.
CREATE POLICY "Kullanıcı kendi yetkilerini görür" ON public.admin_izinleri
  FOR SELECT USING (auth.uid() = user_id);

-- DİKKAT: lib/admin-yetki-actions.ts'nin gerçekten service-role client
-- kullandığını doğrula (kod tabanında `admin` değişkeninin nereden geldiğine
-- bak — createAdminClient() gibi bir şey mi). Eğer normal client kullanıyorsa,
-- yetki atama/silme işlemleri için de ayrı INSERT/DELETE policy'si gerekir
-- (örn. sadece is_admin=true olan kullanıcılar başkalarına yetki atayabilsin).
-- Bu migration bunu VARSAYMIYOR, sadece SELECT policy'si ekliyor — eksik
-- kalan yazma policy'si ayrı bir karar gerektirir, burada tahmin yapmadım.

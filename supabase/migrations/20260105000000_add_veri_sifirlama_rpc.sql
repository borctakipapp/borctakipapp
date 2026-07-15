-- ============================================================================
-- FEATURE — Toplu Finansal Veri Sıfırlama
-- ============================================================================
-- Kapsam (kullanıcı kararı): SADECE kişisel finansal veriler. Ortak Hesap
-- (gruplar/grup_*) ve Aile Bağlantıları (aile_baglantilari) KASITLI OLARAK
-- kapsam DIŞI — bu veriler başka kullanıcıları da etkiliyor, tek taraflı
-- silinmesi onların verisini bozar.
--
-- Çok adımlı bir DB işlemi olduğu için (6 tablo, sıralı silme) Finance
-- Engine'in DIŞINDA, receivable_payment_kaydet ile aynı mimari kategoride
-- bir RPC olarak yazıldı.
--
-- Cascade notu: debts/receivables/savings_goals'a bağlı payments/
-- receivable_payments/savings_entries zaten ON DELETE CASCADE ile otomatik
-- siliniyor (baseline migration'da tanımlı) — burada ayrıca silinmelerine
-- gerek yok, açıklık için yine de mantıksal sırayla yazıldı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tum_finansal_veriyi_sifirla()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- RLS zaten her silmeyi auth.uid()'ye scoped tutuyor (mevcut "ALL USING
  -- (auth.uid() = user_id)" policy'leri) — user_id filtresi burada ayrıca
  -- açık yazılıyor, savunma amaçlı (defense in depth).
  delete from transactions where user_id = auth.uid();
  delete from debts where user_id = auth.uid();               -- cascade: payments
  delete from receivables where user_id = auth.uid();          -- cascade: receivable_payments
  delete from recurring_items where user_id = auth.uid();      -- abonelikler dahil (abonelik_mi bayraklı satırlar)
  delete from savings_goals where user_id = auth.uid();        -- cascade: savings_entries
  delete from harcama_limitleri where user_id = auth.uid();
end;
$function$;

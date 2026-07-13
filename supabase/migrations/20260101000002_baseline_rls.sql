-- ============================================================================
-- BASELINE RLS — borctakipapp
-- ============================================================================
-- Canlı veritabanından pg_policies sorgusuyla çıkarılan gerçek policy'lerin
-- anlık görüntüsü. Fonksiyonlar (is_grup_uyesi, grupta_hic_uye_oldu_mu)
-- ...000001_baseline_functions.sql'de, bu dosyadan önce tanımlanıyor.
--
-- DÜZELTME NOTU: `gruplar` tablosunda RLS bu fazda keşfedildi ve KAPALIYDI —
-- policy'ler yazılıydı ama hiç uygulanmıyordu (aktif güvenlik açığı). Canlı
-- veritabanında 2026-07-14'te ENABLE ROW LEVEL SECURITY ile düzeltildi ve
-- doğrulandı. Bu dosya, düzeltilmiş/doğru hali (RLS açık) yansıtıyor.
-- ============================================================================

ALTER TABLE public.gruplar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harcama_limitleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aile_baglantilari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grup_uyeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grup_harcamalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grup_harcama_bolusumu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grup_odemeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grup_mesajlar ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- debts / receivables / recurring_items / harcama_limitleri / transactions /
-- savings_goals — tek "ALL" policy deseni: kullanıcı sadece kendi satırını
-- yönetir. Not: bu tutarlı tek-policy deseni ile aile_baglantilari/grup_*/
-- profiles'daki "her CRUD için ayrı policy" deseni aynı projede iki farklı
-- stil olarak bir arada duruyor — fonksiyonel bir sorun değil, ama gelecekte
-- yeni bir tablo eklerken hangi deseni izleyeceğini bilinçli seçmek gerekir.
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı kendi borçlarını yönetir" ON public.debts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi alacaklarını yönetir" ON public.receivables
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi düzenli işlemlerini yönetir" ON public.recurring_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi limitlerini yönetir" ON public.harcama_limitleri
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi işlemlerini yönetir" ON public.transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi hedeflerini yönetir" ON public.savings_goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcı kendi ödemelerini görür" ON public.payments
  FOR ALL USING (auth.uid() = (SELECT debts.user_id FROM debts WHERE debts.id = payments.debt_id));

CREATE POLICY "Kullanıcı kendi birikim hareketlerini yönetir" ON public.savings_entries
  FOR ALL USING (auth.uid() = (SELECT savings_goals.user_id FROM savings_goals WHERE savings_goals.id = savings_entries.goal_id));

-- --------------------------------------------------------------------------
-- receivable_payments — CRUD başına ayrı policy (hepsi aynı alt sorgu kuralı)
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı kendi tahsilatlarını görür" ON public.receivable_payments
  FOR SELECT USING (receivable_id IN (SELECT receivables.id FROM receivables WHERE receivables.user_id = auth.uid()));
CREATE POLICY "Kullanıcı kendi tahsilatlarını ekler" ON public.receivable_payments
  FOR INSERT WITH CHECK (receivable_id IN (SELECT receivables.id FROM receivables WHERE receivables.user_id = auth.uid()));
CREATE POLICY "Kullanıcı kendi tahsilatlarını günceller" ON public.receivable_payments
  FOR UPDATE USING (receivable_id IN (SELECT receivables.id FROM receivables WHERE receivables.user_id = auth.uid()))
  WITH CHECK (receivable_id IN (SELECT receivables.id FROM receivables WHERE receivables.user_id = auth.uid()));
CREATE POLICY "Kullanıcı kendi tahsilatlarını siler" ON public.receivable_payments
  FOR DELETE USING (receivable_id IN (SELECT receivables.id FROM receivables WHERE receivables.user_id = auth.uid()));

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı kendi profilini görür" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Kullanıcı kendi profilini günceller" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Kullanıcı kendi profilini oluşturur" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------------
-- aile_baglantilari
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı davet oluşturabilir" ON public.aile_baglantilari
  FOR INSERT WITH CHECK (auth.uid() = davet_eden_id);
CREATE POLICY "Taraflar bağlantıyı günceller" ON public.aile_baglantilari
  FOR UPDATE USING (auth.uid() = davet_eden_id OR auth.uid() = davet_edilen_id);
CREATE POLICY "Taraflar bağlantıyı siler" ON public.aile_baglantilari
  FOR DELETE USING (auth.uid() = davet_eden_id OR auth.uid() = davet_edilen_id);
CREATE POLICY "Taraflar kendi bağlantısını görür" ON public.aile_baglantilari
  FOR SELECT USING (auth.uid() = davet_eden_id OR auth.uid() = davet_edilen_id);

-- --------------------------------------------------------------------------
-- gruplar
-- NOT: Bu tabloda UPDATE policy'si YOK (SELECT/INSERT/DELETE var). Yani grup
-- adı/davet kodu gibi alanları güncelleyen bir ekran varsa, o işlem ya
-- service-role (RLS bypass) ile ya da hiç çalışmıyor demektir. Kod tabanında
-- grup güncelleme özelliği var mı kontrol edilmeli — bulunmazsa bu kasıtlı bir
-- eksiklik, bulunursa gerçek bir bug.
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı grup oluşturabilir" ON public.gruplar
  FOR INSERT WITH CHECK (olusturan_id = auth.uid());
CREATE POLICY "Olusturan grubu silebilir" ON public.gruplar
  FOR DELETE USING (olusturan_id = auth.uid());
CREATE POLICY "Üyeler grubu görür" ON public.gruplar
  FOR SELECT USING (grupta_hic_uye_oldu_mu(id));

-- --------------------------------------------------------------------------
-- grup_uyeler
-- --------------------------------------------------------------------------
CREATE POLICY "Kullanıcı kendi üyelik kaydını her zaman görebilir" ON public.grup_uyeler
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Üyeler üye listesini görür" ON public.grup_uyeler
  FOR SELECT USING (grupta_hic_uye_oldu_mu(grup_id));
CREATE POLICY "Kullanıcı kendini gruba ekleyebilir" ON public.grup_uyeler
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kullanıcı kendi üyeliğini günceller" ON public.grup_uyeler
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kullanıcı kendi üyeliğinden ayrılabilir" ON public.grup_uyeler
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Grup sahibi üye çıkarabilir" ON public.grup_uyeler
  FOR DELETE USING (auth.uid() IN (SELECT gruplar.olusturan_id FROM gruplar WHERE gruplar.id = grup_uyeler.grup_id));

-- --------------------------------------------------------------------------
-- grup_harcamalar / grup_mesajlar / grup_odemeler — aynı iki-fonksiyonlu desen:
-- SELECT = "hiç üye olmuş mu" (grupta_hic_uye_oldu_mu — geçmiş veriyi eski
-- üyeler de görebilir, bilinçli tasarım), yazma işlemleri = "şu an aktif üye
-- mi" (is_grup_uyesi)
-- --------------------------------------------------------------------------
CREATE POLICY "Üyeler harcamaları görür" ON public.grup_harcamalar
  FOR SELECT USING (grupta_hic_uye_oldu_mu(grup_id));
CREATE POLICY "Üyeler harcama ekler" ON public.grup_harcamalar
  FOR INSERT WITH CHECK (is_grup_uyesi(grup_id));
CREATE POLICY "Üyeler harcama günceller" ON public.grup_harcamalar
  FOR UPDATE USING (is_grup_uyesi(grup_id)) WITH CHECK (is_grup_uyesi(grup_id));
CREATE POLICY "Üyeler harcama siler" ON public.grup_harcamalar
  FOR DELETE USING (is_grup_uyesi(grup_id));

CREATE POLICY "Üyeler mesajları görür" ON public.grup_mesajlar
  FOR SELECT USING (grupta_hic_uye_oldu_mu(grup_id));
CREATE POLICY "Üyeler mesaj gönderir" ON public.grup_mesajlar
  FOR INSERT WITH CHECK (is_grup_uyesi(grup_id));

CREATE POLICY "Üyeler ödemeleri görür" ON public.grup_odemeler
  FOR SELECT USING (grupta_hic_uye_oldu_mu(grup_id));
CREATE POLICY "Üyeler ödeme ekler" ON public.grup_odemeler
  FOR INSERT WITH CHECK (is_grup_uyesi(grup_id));

-- --------------------------------------------------------------------------
-- grup_harcama_bolusumu
-- --------------------------------------------------------------------------
CREATE POLICY "Üyeler bölüşümü görür" ON public.grup_harcama_bolusumu
  FOR SELECT USING (harcama_id IN (SELECT grup_harcamalar.id FROM grup_harcamalar WHERE grupta_hic_uye_oldu_mu(grup_harcamalar.grup_id)));
CREATE POLICY "Üyeler bölüşüm ekler" ON public.grup_harcama_bolusumu
  FOR INSERT WITH CHECK (harcama_id IN (SELECT grup_harcamalar.id FROM grup_harcamalar WHERE is_grup_uyesi(grup_harcamalar.grup_id)));

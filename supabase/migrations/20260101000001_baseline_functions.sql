-- ============================================================================
-- BASELINE FONKSİYONLAR — borctakipapp
-- ============================================================================
-- Şema dosyasından SONRA, RLS dosyasından ÖNCE çalışır (dosya adı sırası:
-- ...000000_schema -> ...000001_functions -> ...000002_rls). RLS
-- policy'lerinden ikisi (is_grup_uyesi, grupta_hic_uye_oldu_mu) bu
-- fonksiyonlara referans veriyor, bu yüzden RLS dosyasından önce tanımlı
-- olmaları gerekiyor.
--
-- Fonksiyonlar canlı veritabanından pg_get_functiondef() ile aynen alındı,
-- hiçbir mantık değiştirilmedi.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Yardımcı fonksiyonlar (sadece RLS policy'leri içinde kullanılıyor, hiçbir
-- yerden .rpc() ile çağrılmıyor)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_grup_uyesi(_grup_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return exists (
    select 1 from grup_uyeler
    where grup_id = _grup_id and user_id = auth.uid() and aktif = true
  );
end;
$function$;

-- NOT: grupta_hic_uye_oldu_mu — is_grup_uyesi'nden TEK farkı: "aktif = true"
-- şartı YOK. Yani gruptan çıkmış/çıkarılmış eski bir üye bile geçmiş harcama/
-- mesaj/ödeme kayıtlarını görmeye devam edebiliyor — bilinçli bir tasarım
-- (geçmiş veri kaybolmasın diye), ama SELECT policy'lerinde kasıtlı olarak
-- kullanılan bir gevşetme olduğunu bilerek okumak lazım.
CREATE OR REPLACE FUNCTION public.grupta_hic_uye_oldu_mu(_grup_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return exists (select 1 from grup_uyeler where grup_id = _grup_id and user_id = auth.uid());
end;
$function$;

-- --------------------------------------------------------------------------
-- Borçlar
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.odeme_kaydet(p_debt_id uuid, p_amount numeric, p_yeni_kalan_tutar numeric, p_yeni_taksit_kalan integer, p_yeni_due_date date, p_yeni_status text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into payments (debt_id, amount) values (p_debt_id, p_amount);

  update debts set
    remaining_amount = p_yeni_kalan_tutar,
    installment_remaining = p_yeni_taksit_kalan,
    due_date = p_yeni_due_date,
    status = p_yeni_status
  where id = p_debt_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.odeme_sil_ve_geri_al(p_payment_ids uuid[], p_debt_id uuid, p_yeni_kalan_tutar numeric, p_yeni_taksit_kalan integer, p_yeni_due_date date, p_yeni_status text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  delete from payments where id = any(p_payment_ids) and debt_id = p_debt_id;

  update debts set
    remaining_amount = p_yeni_kalan_tutar,
    installment_remaining = p_yeni_taksit_kalan,
    due_date = p_yeni_due_date,
    status = p_yeni_status
  where id = p_debt_id;
end;
$function$;

-- --------------------------------------------------------------------------
-- Bekleyen Alacaklar
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receivable_payment_kaydet(p_receivable_id uuid, p_amount numeric, p_paid_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(yeni_kalan_tutar numeric, yeni_durum text, receivable_payment_id uuid, transaction_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  _mevcut_kalan numeric;
  _mevcut_durum text;
  _contact_name text;
  _kullanici_id uuid;
  _yeni_kalan numeric;
  _yeni_durum text;
  _yeni_closed_at timestamp with time zone;
  _yeni_payment_id uuid;
  _yeni_transaction_id uuid;
begin
  select remaining_amount, status, contact_name, user_id
  into _mevcut_kalan, _mevcut_durum, _contact_name, _kullanici_id
  from receivables
  where id = p_receivable_id
  for update;

  if not found then
    raise exception 'Alacak bulunamadı veya bu alacağa erişim yetkin yok';
  end if;

  if _mevcut_durum = 'cancelled' then
    raise exception 'Bu alacak iptal edilmiş, tahsilat kaydedilemez';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Tahsilat tutarı sıfırdan büyük olmalı';
  end if;

  if p_amount > _mevcut_kalan then
    raise exception 'Tahsilat tutarı kalan tutardan büyük olamaz (kalan: %)', _mevcut_kalan;
  end if;

  _yeni_kalan := _mevcut_kalan - p_amount;

  if _yeni_kalan = 0 then
    _yeni_durum := 'completed';
    _yeni_closed_at := now();
  else
    _yeni_durum := 'pending';
    _yeni_closed_at := null;
  end if;

  insert into transactions (user_id, type, category, amount, transaction_date, description, is_recurring, receivable_id)
  values (_kullanici_id, 'income', 'Alacak Tahsilatı', p_amount, p_paid_at::date, _contact_name || ' tahsilatı', false, p_receivable_id)
  returning id into _yeni_transaction_id;

  insert into receivable_payments (receivable_id, amount, paid_at, transaction_id)
  values (p_receivable_id, p_amount, p_paid_at, _yeni_transaction_id)
  returning id into _yeni_payment_id;

  update receivables
  set remaining_amount = _yeni_kalan,
      status = _yeni_durum,
      closed_at = _yeni_closed_at
  where id = p_receivable_id;

  return query select _yeni_kalan, _yeni_durum, _yeni_payment_id, _yeni_transaction_id;
end;
$function$;

-- --------------------------------------------------------------------------
-- Gelir/Gider + Birikim
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gelir_gider_ekle_ve_aktar(p_user_id uuid, p_type text, p_category text, p_amount numeric, p_transaction_date date, p_description text, p_is_recurring boolean, p_recurring_id uuid, p_goal_id uuid, p_goal_direction text DEFAULT 'add'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into transactions (user_id, type, category, amount, transaction_date, description, is_recurring, recurring_id, savings_goal_id)
  values (p_user_id, p_type, p_category, p_amount, p_transaction_date, p_description, p_is_recurring, p_recurring_id, p_goal_id);

  if p_goal_id is not null then
    insert into savings_entries (goal_id, amount, type) values (p_goal_id, p_amount, p_goal_direction);

    if p_goal_direction = 'add' then
      update savings_goals set current_amount = current_amount + p_amount where id = p_goal_id;
    else
      update savings_goals set current_amount = greatest(0, current_amount - p_amount) where id = p_goal_id;
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.birikim_hareket_ekle(p_goal_id uuid, p_amount numeric, p_type text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  insert into savings_entries (goal_id, amount, type) values (p_goal_id, p_amount, p_type);

  if p_type = 'add' then
    update savings_goals set current_amount = current_amount + p_amount where id = p_goal_id;
  else
    update savings_goals set current_amount = greatest(0, current_amount - p_amount) where id = p_goal_id;
  end if;
end;
$function$;

-- --------------------------------------------------------------------------
-- Ortak Hesap (Gruplar)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grup_harcama_gider_ekle(p_harcama_id uuid, p_odeyen_id uuid, p_tutar numeric, p_tarih date, p_aciklama text, p_grup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uye_mi boolean;
begin
  select exists (select 1 from grup_uyeler where grup_id = p_grup_id and user_id = auth.uid()) into _uye_mi;
  if not _uye_mi then raise exception 'Yetkisiz erişim'; end if;

  insert into transactions (user_id, type, category, amount, transaction_date, description, is_recurring, grup_harcama_id)
  values (p_odeyen_id, 'expense', 'Ortak Hesap', p_tutar, p_tarih, p_aciklama, false, p_harcama_id);
end;
$function$;

-- BULGU (migration'dan bağımsız, ayrıca değerlendirilmeli): Bu fonksiyon
-- SADECE `transactions` tablosunu güncelliyor — `grup_harcamalar.tutar`/
-- `tarih`/`aciklama` alanlarına HİÇ dokunmuyor. Yani bir grup harcaması
-- düzenlendiğinde, `grup_harcamalar` tablosundaki orijinal satır eski
-- (bayat) değerlerle kalmaya devam ediyor — sadece `transactions` üzerinden
-- türetilen özet/rapor ekranları doğru görünür, `grup_harcamalar`'ı
-- doğrudan okuyan herhangi bir yer (örn. grup detay sayfasındaki harcama
-- listesi) muhtemelen eski tutarı gösteriyor olabilir. Bu, TECHNICAL_DEBT.md'ye
-- ayrı bir madde olarak eklenmeli, bu migration fazının kapsamı dışında.
CREATE OR REPLACE FUNCTION public.grup_harcama_gider_guncelle(p_harcama_id uuid, p_tutar numeric, p_tarih date, p_aciklama text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _grup_id uuid; _uye_mi boolean;
begin
  select grup_id into _grup_id from grup_harcamalar where id = p_harcama_id;
  select exists (select 1 from grup_uyeler where grup_id = _grup_id and user_id = auth.uid()) into _uye_mi;
  if not _uye_mi then raise exception 'Yetkisiz erişim'; end if;

  update transactions set amount = p_tutar, transaction_date = p_tarih, description = p_aciklama
  where grup_harcama_id = p_harcama_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grup_mutabakat_islemler_ekle(p_odeme_id uuid, p_borclu_id uuid, p_alacakli_id uuid, p_tutar numeric, p_grup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uye_mi boolean;
begin
  select exists (select 1 from grup_uyeler where grup_id = p_grup_id and user_id = auth.uid()) into _uye_mi;
  if not _uye_mi then raise exception 'Yetkisiz erişim'; end if;

  insert into transactions (user_id, type, category, amount, transaction_date, description, is_recurring, grup_odeme_id)
  values (p_borclu_id, 'expense', 'Ortak Hesap', p_tutar, current_date, 'Ortak hesap mutabakatı', false, p_odeme_id);

  insert into transactions (user_id, type, category, amount, transaction_date, description, is_recurring, grup_odeme_id)
  values (p_alacakli_id, 'income', 'Ortak Hesap Geri Ödeme', p_tutar, current_date, 'Ortak hesap mutabakatı', false, p_odeme_id);
end;
$function$;

-- --------------------------------------------------------------------------
-- Aile Bağlantıları
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_ozet_getir(_partner_id uuid)
 RETURNS TABLE(toplam_borc numeric, bu_ay_net numeric, toplam_birikim numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _gecerli boolean;
  _gelir numeric;
  _gider numeric;
  _borc_odeme numeric;
  _ay_baslangic date := date_trunc('month', current_date)::date;
begin
  select exists (
    select 1 from aile_baglantilari
    where durum = 'onaylandi'
      and ((davet_eden_id = auth.uid() and davet_edilen_id = _partner_id)
        or (davet_edilen_id = auth.uid() and davet_eden_id = _partner_id))
  ) into _gecerli;

  if not _gecerli then
    raise exception 'Yetkisiz erişim';
  end if;

  -- NOT: Bu SQL, lib/finans-motoru.ts içindeki ayKirilimiHesapla() ile AYNI kuralı
  -- uyguluyor (gelir - gider - borç ödemesi). SQL fonksiyonu TypeScript'i doğrudan
  -- çağıramadığı için elle eşleniyor — o dosyadaki mantık değişirse burası da
  -- güncellenmeli. (scripts/dogrula-partner-ozet.ts bu sapmayı otomatik yakalıyor.)
  select coalesce(sum(amount), 0) into _gelir from transactions
    where user_id = _partner_id and type = 'income' and transaction_date >= _ay_baslangic;
  select coalesce(sum(amount), 0) into _gider from transactions
    where user_id = _partner_id and type = 'expense' and transaction_date >= _ay_baslangic;
  select coalesce(sum(p.amount), 0) into _borc_odeme from payments p
    join debts d on d.id = p.debt_id
    where d.user_id = _partner_id and p.paid_at >= _ay_baslangic::timestamp;

  return query
  select
    coalesce((select sum(remaining_amount) from debts where user_id = _partner_id and status = 'active'), 0),
    _gelir - _gider - _borc_odeme,
    coalesce((select sum(current_amount) from savings_goals where user_id = _partner_id), 0);
end;
$function$;

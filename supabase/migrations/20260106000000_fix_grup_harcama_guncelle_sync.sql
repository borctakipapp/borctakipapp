-- ============================================================================
-- BUG FIX — grup_harcama_gider_guncelle artık grup_harcamalar'ı da güncelliyor
-- ============================================================================
-- TECHNICAL_DEBT.md madde 8: RPC sadece transactions'ı güncelliyordu,
-- grup_harcamalar tablosundaki orijinal satır eski (bayat) kalıyordu.
-- ============================================================================

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

  update grup_harcamalar set tutar = p_tutar, tarih = p_tarih, aciklama = p_aciklama
  where id = p_harcama_id;
end;
$function$;

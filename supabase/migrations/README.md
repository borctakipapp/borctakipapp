# SQL Migration Süreci — borctakipapp

## Bu klasördeki dosyalar

- `20260101000000_baseline_schema.sql` — mevcut (2026-07-14 canlı) şemanın anlık görüntüsü
- `20260101000001_baseline_functions.sql` — mevcut tüm RPC + yardımcı fonksiyonlar
- `20260101000002_baseline_rls.sql` — mevcut tüm RLS policy'leri (+ `gruplar` RLS açığının düzeltilmiş hali)
- `20260102000000_fix_admin_izinleri_missing_table.sql` — gerçek bir bug fix (eksik tablo), baseline'ın parçası DEĞİL

## ⚠️ Baseline'ı canlıya UYGULAMADAN ÖNCE

Bu dosyalar canlı veritabanının **mevcut halini** temsil ediyor — `admin_izinleri` fix'i hariç,
hepsi zaten var olan şeyi kayıt altına alıyor. Bu yüzden:

1. **Asla `supabase db push` ile canlıya "ilk kez" uygulama** — tablolar zaten var, `CREATE TABLE` hata verir.
2. Bunun yerine, CLI'nin migration takip tablosuna "bu zaten uygulanmış" diye işaretle:
supabase migration repair --status applied 20260101000000
supabase migration repair --status applied 20260101000001
supabase migration repair --status applied 20260101000002
3. Sadece `20260102000000_fix_admin_izinleri_missing_table.sql` GERÇEKTEN yeni — bunu normal
   şekilde `supabase db push` ile uygula (ya da SQL Editor'den elle çalıştır).
4. Doğrulama: `supabase db diff` ile local'de bu dosyalardan kurulan şema ile canlı şemayı
   karşılaştır, fark çıkmamalı (admin_izinleri hariç).

## Bundan sonraki her SQL değişikliği için standart

1. Yeni bir migration dosyası oluştur:
supabase migration new <aciklayici_isim>
   Bu, `supabase/migrations/` altına otomatik tarih damgalı bir dosya oluşturur.
2. Değişikliği o dosyaya yaz (CREATE TABLE / ALTER TABLE / CREATE POLICY / CREATE FUNCTION vb.)
3. **Asla Supabase Dashboard'dan doğrudan SQL çalıştırıp koda yansıtmayı unutma** — dashboard'dan
   yapılan her değişiklik, bu projenin tam olarak kurtulmaya çalıştığı soruna geri döner.
4. Kod (TS) ve migration (SQL) değişikliği varsa, **aynı commit/PR'da** birlikte review edilmeli.
5. `supabase db push` ile canlıya uygula.

## Bilinen eksikler / doğrulanmadan bırakılanlar

- `admin_izinleri.izin` kolonunun olası değerleri için CHECK kısıtı eklenmedi — kod tabanında
  sabit bir liste bulunamadı. Gerçek değerler netleşince eklenmelidir.
- `admin_izinleri`'nin yazma (INSERT/DELETE) tarafında RLS policy'si yok — `lib/admin-yetki-actions.ts`'nin
  gerçekten service-role client kullandığı doğrulanmalı, kullanmıyorsa yazma policy'si eksik kalır.
- `gruplar` tablosunda UPDATE policy'si yok (kasıtlı mı, eksik mi netleşmedi — `20260101000002_baseline_rls.sql`
  içinde not var).
- `grup_harcama_gider_guncelle` RPC'si `grup_harcamalar` tablosunu güncellemiyor, sadece
  `transactions`'ı güncelliyor — ayrı bir teknik borç maddesi olarak değerlendirilmeli
  (`20260101000001_baseline_functions.sql` içinde not var).
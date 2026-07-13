-- ============================================================================
-- BASELINE ŞEMA — borctakipapp
-- ============================================================================
-- Bu dosya, 2026-07-14 tarihinde canlı Supabase veritabanından information_schema,
-- pg_constraint ve pg_indexes sorgularıyla çıkarılmış GERÇEK şemanın anlık
-- görüntüsüdür. Yeni bir kurulum değil — zaten var olan tabloların kayıt altına
-- alınmasıdır. Bu yüzden bu dosya migration geçmişine "zaten uygulanmış" olarak
-- işaretlenmeli (bkz. supabase/migrations/README.md), ASLA canlıya tekrar
-- push edilmemeli.
--
-- NOT (doğrulanmamış varsayım): user_id / davet_eden_id / olusturan_id gibi
-- kolonların FOREIGN KEY hedefi sorgularda "null" döndü (auth şemasına çapraz
-- referans information_schema.constraint_column_usage'da bazen çözülmüyor).
-- Bunların tamamı auth.users(id)'ye referans verdiği varsayılıyor — bu,
-- Supabase'in standart deseni ve kod tabanındaki auth.uid() kullanımıyla
-- tutarlı, ama tek tek doğrulanmadı. Şüpheli bir satır görürsen işaretle.
-- ============================================================================

-- --------------------------------------------------------------------------
-- gruplar (bağımlılığı yok, ilk oluşturulmalı)
-- --------------------------------------------------------------------------
CREATE TABLE public.gruplar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ad text NOT NULL,
  olusturan_id uuid NOT NULL REFERENCES auth.users(id),
  davet_kodu text NOT NULL DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 10),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT gruplar_pkey PRIMARY KEY (id),
  CONSTRAINT gruplar_davet_kodu_key UNIQUE (davet_kodu)
);

-- --------------------------------------------------------------------------
-- profiles (auth.users ile 1:1 — id, kendi default'u yok, kayıt sırasında
-- uygulama tarafından auth.users.id ile aynı değer verilerek insert ediliyor;
-- DB tetikleyicisi (trigger) YOK, doğrulandı — bkz. RLS "kendi profilini
-- oluşturur" INSERT policy'si)
-- --------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz DEFAULT now(),
  birth_date date,
  phone text,
  city text,
  gender text,
  income_range text,
  household_size integer,
  is_admin boolean DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- debts
-- --------------------------------------------------------------------------
CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  institution_name text NOT NULL,
  total_amount numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  installment_total integer,
  installment_remaining integer,
  interest_rate numeric,
  due_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  prepayment_strategy text DEFAULT 'vade_kisalsin',
  principal_amount numeric,
  aylik_taksit_tutari numeric,
  kmh_limit numeric,
  CONSTRAINT debts_pkey PRIMARY KEY (id),
  CONSTRAINT debts_prepayment_strategy_check
    CHECK (prepayment_strategy = ANY (ARRAY['vade_kisalsin'::text, 'taksit_dussun'::text]))
);

-- --------------------------------------------------------------------------
-- receivables
-- --------------------------------------------------------------------------
CREATE TABLE public.receivables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id), -- delete_rule=NO ACTION, doğrulandı (CASCADE DEĞİL)
  contact_name text NOT NULL,
  description text,
  total_amount numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  expected_date date,
  status text NOT NULL DEFAULT 'pending',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receivables_pkey PRIMARY KEY (id),
  CONSTRAINT receivables_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text]))
);

-- --------------------------------------------------------------------------
-- recurring_items
-- --------------------------------------------------------------------------
CREATE TABLE public.recurring_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL,
  day_of_month integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recurring_items_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- savings_goals
-- --------------------------------------------------------------------------
CREATE TABLE public.savings_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  target_date date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT savings_goals_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- harcama_limitleri
-- --------------------------------------------------------------------------
CREATE TABLE public.harcama_limitleri (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  category text NOT NULL,
  aylik_limit numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT harcama_limitleri_pkey PRIMARY KEY (id),
  CONSTRAINT harcama_limitleri_user_id_category_key UNIQUE (user_id, category)
);

-- --------------------------------------------------------------------------
-- aile_baglantilari
-- --------------------------------------------------------------------------
CREATE TABLE public.aile_baglantilari (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  davet_eden_id uuid NOT NULL REFERENCES auth.users(id),
  davet_edilen_id uuid NOT NULL REFERENCES auth.users(id),
  davet_edilen_email text NOT NULL,
  durum text NOT NULL DEFAULT 'bekliyor',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT aile_baglantilari_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- grup_uyeler
-- --------------------------------------------------------------------------
CREATE TABLE public.grup_uyeler (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grup_id uuid NOT NULL REFERENCES public.gruplar(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_soyad text,
  katilma_tarihi timestamptz DEFAULT now(),
  iban text,
  aktif boolean NOT NULL DEFAULT true,
  CONSTRAINT grup_uyeler_pkey PRIMARY KEY (id),
  CONSTRAINT grup_uyeler_grup_id_user_id_key UNIQUE (grup_id, user_id)
);

-- --------------------------------------------------------------------------
-- grup_harcamalar
-- --------------------------------------------------------------------------
CREATE TABLE public.grup_harcamalar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grup_id uuid NOT NULL REFERENCES public.gruplar(id) ON DELETE CASCADE,
  odeyen_id uuid NOT NULL REFERENCES auth.users(id),
  aciklama text NOT NULL,
  tutar numeric NOT NULL,
  tarih date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grup_harcamalar_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- grup_mesajlar
-- --------------------------------------------------------------------------
CREATE TABLE public.grup_mesajlar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grup_id uuid NOT NULL REFERENCES public.gruplar(id) ON DELETE CASCADE,
  gonderen_id uuid NOT NULL REFERENCES auth.users(id),
  gonderen_ad text,
  mesaj text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grup_mesajlar_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- grup_odemeler
-- --------------------------------------------------------------------------
CREATE TABLE public.grup_odemeler (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grup_id uuid NOT NULL REFERENCES public.gruplar(id) ON DELETE CASCADE,
  odeyen_id uuid NOT NULL REFERENCES auth.users(id),
  alan_id uuid NOT NULL REFERENCES auth.users(id),
  tutar numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grup_odemeler_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- transactions (recurring_items, savings_goals, grup_harcamalar,
-- grup_odemeler, receivables'a bağımlı — hepsi yukarıda oluşturuldu)
-- --------------------------------------------------------------------------
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  transaction_date date NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  is_recurring boolean DEFAULT false,
  recurring_id uuid REFERENCES public.recurring_items(id) ON DELETE SET NULL,
  savings_goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  grup_harcama_id uuid REFERENCES public.grup_harcamalar(id) ON DELETE CASCADE,
  grup_odeme_id uuid REFERENCES public.grup_odemeler(id) ON DELETE CASCADE,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE SET NULL,
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- payments
-- --------------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz DEFAULT now(),
  installments_covered integer DEFAULT 0,
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- receivable_payments
-- --------------------------------------------------------------------------
CREATE TABLE public.receivable_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL, -- P1 fazında doğrulandı
  CONSTRAINT receivable_payments_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- savings_entries
-- --------------------------------------------------------------------------
CREATE TABLE public.savings_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'add',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT savings_entries_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------------------
-- grup_harcama_bolusumu
-- --------------------------------------------------------------------------
CREATE TABLE public.grup_harcama_bolusumu (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  harcama_id uuid NOT NULL REFERENCES public.grup_harcamalar(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  pay_tutari numeric NOT NULL,
  CONSTRAINT grup_harcama_bolusumu_pkey PRIMARY KEY (id)
);

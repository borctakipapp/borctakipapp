import { createClient } from '@supabase/supabase-js'

// DİKKAT: Bu dosya SADECE sunucu tarafı (server component / route handler) kodunda kullanılmalı.
// service_role anahtarı RLS kurallarını atlıyor, tüm veritabanına erişebiliyor — tarayıcıya asla gitmemeli.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

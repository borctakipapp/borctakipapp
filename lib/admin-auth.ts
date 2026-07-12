import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Her admin sayfasının başında çağrılır: giriş yapmamışsa login'e, admin değilse dashboard'a atar.
export async function adminGirisKontrol() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  return user
}

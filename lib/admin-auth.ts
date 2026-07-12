import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const TUM_YETKILER = [
  { anahtar: 'kullanici_goruntule', etiket: 'Kullanıcıları Görüntüleme' },
  { anahtar: 'kullanici_duzenle', etiket: 'Kullanıcı Profili Düzenleme' },
  { anahtar: 'kullanici_sil', etiket: 'Kullanıcı Silme / Pasif Etme' },
  { anahtar: 'veri_mudahale', etiket: 'Kullanıcı Finansal Verisine Müdahale' },
  { anahtar: 'yetki_yonetimi', etiket: 'Yetki Yönetimi (diğer adminlere yetki verme)' },
] as const

export type YetkiAnahtari = typeof TUM_YETKILER[number]['anahtar']

// Kurucu hesap — her zaman TÜM yetkilere sahip, admin_izinleri tablosunda kaydı olmasa bile.
const KURUCU_EMAIL = 'borctakipapp@gmail.com'

// Her admin sayfasının başında çağrılır: giriş yapmamışsa login'e, admin değilse dashboard'a atar.
export async function adminGirisKontrol() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  return user
}

// Belirli bir yetkiyi kontrol eder — yoksa false döner (sayfa/bileşen kendi karar verir: gizle/engelle).
export async function adminYetkiKontrol(izin: YetkiAnahtari): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (user.email === KURUCU_EMAIL) return true

  const { data } = await supabase.from('admin_izinleri').select('id').eq('user_id', user.id).eq('izin', izin).maybeSingle()
  return !!data
}

// Bir kullanıcının TÜM yetkilerini tek seferde çeker (Yetki Yönetimi sayfası için)
export async function adminTumYetkileriGetir(userId: string, kurucuMu: boolean): Promise<Set<YetkiAnahtari>> {
  if (kurucuMu) return new Set(TUM_YETKILER.map((y) => y.anahtar))
  const supabase = await createClient()
  const { data } = await supabase.from('admin_izinleri').select('izin').eq('user_id', userId)
  return new Set((data || []).map((d) => d.izin as YetkiAnahtari))
}

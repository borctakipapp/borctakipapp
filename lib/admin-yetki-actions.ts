'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminYetkiKontrol, type YetkiAnahtari } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'

export async function yetkileriGuncelle(hedefUserId: string, yeniYetkiler: YetkiAnahtari[]) {
  const yetkim = await adminYetkiKontrol('yetki_yonetimi')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Oturum bulunamadı.' }

  const admin = createAdminClient()

  // Önce bu kullanıcının tüm mevcut izinlerini sil, sonra seçilenleri yeniden ekle (basit ve güvenilir)
  await admin.from('admin_izinleri').delete().eq('user_id', hedefUserId)

  if (yeniYetkiler.length > 0) {
    const kayitlar = yeniYetkiler.map((izin) => ({ user_id: hedefUserId, izin, veren_id: user.id }))
    const { error } = await admin.from('admin_izinleri').insert(kayitlar)
    if (error) return { hata: error.message }
  }

  revalidatePath('/admin/yetkiler')
  return { basarili: true }
}

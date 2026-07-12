'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function davetGonder(partnerEmail: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Oturum bulunamadı.' }

  const temizEmail = partnerEmail.toLowerCase().trim()
  if (temizEmail === user.email?.toLowerCase()) {
    return { hata: 'Kendini davet edemezsin.' }
  }

  // E-posta sahibini bulmak için service role gerekiyor (auth.users doğrudan sorgulanamaz)
  const admin = createAdminClient()
  const { data: kullanicilar } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const hedef = kullanicilar?.users.find((u) => u.email?.toLowerCase() === temizEmail)

  if (!hedef) {
    return { hata: 'Bu e-posta ile kayıtlı bir kullanıcı bulunamadı. Partnerin önce borctakipapp\'a kayıt olmalı.' }
  }

  const { error } = await supabase.from('aile_baglantilari').insert({
    davet_eden_id: user.id,
    davet_edilen_id: hedef.id,
    davet_edilen_email: temizEmail,
    durum: 'bekliyor',
  })

  if (error) return { hata: error.message }
  return { basarili: true }
}

export async function davetiOnayla(baglantiId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('aile_baglantilari').update({ durum: 'onaylandi' }).eq('id', baglantiId)
  if (error) return { hata: error.message }
  return { basarili: true }
}

export async function baglantiyiSil(baglantiId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('aile_baglantilari').delete().eq('id', baglantiId)
  if (error) return { hata: error.message }
  return { basarili: true }
}
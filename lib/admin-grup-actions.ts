'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { adminYetkiKontrol } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'

export async function adminHarcamaSil(harcamaId: string, grupId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  // ON DELETE CASCADE sayesinde bölüşüm ve bağlı kişisel gider kaydı da otomatik silinir
  const { error } = await admin.from('grup_harcamalar').delete().eq('id', harcamaId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/gruplar/${grupId}`)
  return { basarili: true }
}

export async function adminOdemeSil(odemeId: string, grupId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  // ON DELETE CASCADE sayesinde bağlı kişisel gider/gelir kayıtları da otomatik silinir
  const { error } = await admin.from('grup_odemeler').delete().eq('id', odemeId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/gruplar/${grupId}`)
  return { basarili: true }
}

export async function adminUyeCikar(uyelikId: string, grupId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('grup_uyeler').update({ aktif: false }).eq('id', uyelikId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/gruplar/${grupId}`)
  return { basarili: true }
}

export async function adminUyeEkle(grupId: string, email: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { data: kullanicilar } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const hedef = kullanicilar?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim())
  if (!hedef) return { hata: 'Bu e-posta ile kayıtlı bir kullanıcı bulunamadı.' }

  const { data: profil } = await admin.from('profiles').select('full_name').eq('id', hedef.id).single()
  const gorunenAd = profil?.full_name?.trim() || hedef.email

  const { data: eskiKayit } = await admin.from('grup_uyeler').select('id').eq('grup_id', grupId).eq('user_id', hedef.id).maybeSingle()
  if (eskiKayit) {
    const { error } = await admin.from('grup_uyeler').update({ aktif: true }).eq('id', eskiKayit.id)
    if (error) return { hata: error.message }
  } else {
    const { error } = await admin.from('grup_uyeler').insert({ grup_id: grupId, user_id: hedef.id, ad_soyad: gorunenAd })
    if (error) return { hata: error.message }
  }

  revalidatePath(`/admin/gruplar/${grupId}`)
  return { basarili: true }
}

export async function adminGrupSil(grupId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('gruplar').delete().eq('id', grupId)
  if (error) return { hata: error.message }
  return { basarili: true }
}

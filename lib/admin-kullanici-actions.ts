'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { adminYetkiKontrol } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'

export async function kullaniciPasifEt(userId: string) {
  const yetkim = await adminYetkiKontrol('kullanici_sil')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function kullaniciAktifEt(userId: string) {
  const yetkim = await adminYetkiKontrol('kullanici_sil')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function kullaniciKaliciSil(userId: string) {
  const yetkim = await adminYetkiKontrol('kullanici_sil')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { hata: error.message }
  return { basarili: true }
}

export async function profilGuncelle(userId: string, alanlar: {
  full_name?: string; phone?: string; city?: string; gender?: string; income_range?: string; household_size?: number | null
}) {
  const yetkim = await adminYetkiKontrol('kullanici_duzenle')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').upsert({ id: userId, ...alanlar })
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function borcGuncelle(borcId: string, userId: string, alanlar: { remaining_amount?: number; status?: string; institution_name?: string }) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('debts').update(alanlar).eq('id', borcId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function borcSil(borcId: string, userId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('debts').delete().eq('id', borcId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function hedefGuncelle(hedefId: string, userId: string, alanlar: { current_amount?: number; target_amount?: number; goal_name?: string }) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('savings_goals').update(alanlar).eq('id', hedefId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

export async function hedefSil(hedefId: string, userId: string) {
  const yetkim = await adminYetkiKontrol('veri_mudahale')
  if (!yetkim) return { hata: 'Bu işlem için yetkin yok.' }

  const admin = createAdminClient()
  const { error } = await admin.from('savings_goals').delete().eq('id', hedefId)
  if (error) return { hata: error.message }
  revalidatePath(`/admin/kullanicilar/${userId}`)
  return { basarili: true }
}

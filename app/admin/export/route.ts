import { NextResponse } from 'next/server'
import { adminGirisKontrol } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  await adminGirisKontrol()
  const admin = createAdminClient()

  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const kullanicilar = authData?.users || []

  const { data: borclar } = await admin.from('debts').select('user_id, remaining_amount').eq('status', 'active')
  const borcMap: Record<string, number> = {}
  for (const b of borclar || []) {
    borcMap[b.user_id] = (borcMap[b.user_id] || 0) + Number(b.remaining_amount)
  }

  const satirlar = [['ID', 'E-posta', 'Kayıt Tarihi', 'Toplam Borç (TL)']]
  for (const u of kullanicilar) {
    satirlar.push([
      u.id,
      u.email || '',
      new Date(u.created_at).toLocaleDateString('tr-TR'),
      String(borcMap[u.id] || 0),
    ])
  }

  const csv = satirlar.map((satir) => satir.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',')).join('\n')
  const csvBom = '\uFEFF' + csv // Excel'de Türkçe karakterlerin doğru görünmesi için BOM ekliyoruz

  return new NextResponse(csvBom, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="kullanicilar.csv"',
    },
  })
}
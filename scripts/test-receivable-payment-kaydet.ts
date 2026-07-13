// ============================================================================
// OTOMATİK TEST — receivable_payment_kaydet RPC'si
// ============================================================================
// 6 senaryoyu gerçek Supabase'e karşı çalıştırır: tam tahsilat, kısmi tahsilat,
// fazla tahsilat reddi, iptal edilmiş kayıt reddi, ardışık kısmi tahsilat,
// eşzamanlı (race condition) tahsilat.
//
// ÇALIŞTIRMA:
//   npm install -D tsx   (bir kere)
//   npx tsx scripts/test-receivable-payment-kaydet.ts
//
// GEREKLİ (.env.local'de zaten olmalı):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// GÜVENLİK: Geçici bir test kullanıcısı ve test alacakları oluşturur, testler
// bitince (başarılı/başarısız fark etmez) HEPSİNİ temizler.
// ============================================================================

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

// tsx, Next.js'in aksine .env.local'i otomatik okumuyor — burada elle yüklüyoruz.
// (Harici bir "dotenv" paketine ihtiyaç duymamak için minik, bağımlılıksız bir okuyucu.)
function envLocalYukle() {
  const yol = resolve(process.cwd(), '.env.local')
  if (!existsSync(yol)) {
    console.error(`HATA: ${yol} bulunamadı. Bu scripti proje kök dizininden (borctakipapp klasöründen) çalıştırdığından emin ol.`)
    process.exit(1)
  }
  const icerik = readFileSync(yol, 'utf-8')
  for (const satir of icerik.split('\n')) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith('#')) continue
    const esIndex = temiz.indexOf('=')
    if (esIndex === -1) continue
    const anahtar = temiz.slice(0, esIndex).trim()
    let deger = temiz.slice(esIndex + 1).trim()
    if ((deger.startsWith('"') && deger.endsWith('"')) || (deger.startsWith("'") && deger.endsWith("'"))) {
      deger = deger.slice(1, -1)
    }
    if (!process.env[anahtar]) process.env[anahtar] = deger
  }
}
envLocalYukle()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('HATA: .env.local\'de NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

type SonucSatiri = { senaryo: string; basarili: boolean; detay: string }
const sonuclar: SonucSatiri[] = []

function kaydet(senaryo: string, basarili: boolean, detay: string) {
  sonuclar.push({ senaryo, basarili, detay })
  console.log(`${basarili ? '✅' : '❌'} ${senaryo}: ${detay}`)
}

async function yeniReceivableOlustur(userId: string, remainingAmount: number, status: string = 'pending') {
  const { data, error } = await admin.from('receivables').insert({
    user_id: userId, contact_name: 'Test Kişi', total_amount: remainingAmount,
    remaining_amount: remainingAmount, status,
  }).select().single()
  if (error || !data) throw new Error(`Receivable oluşturulamadı: ${error?.message}`)
  return data
}

async function main() {
  const zaman = Date.now()
  const email = `test-receivable-${zaman}@dogrulama.local`
  const sifre = `Test${zaman}!Aa1`
  let userId: string | null = null
  const olusturulanReceivableIds: string[] = []

  try {
    console.log('Kurulum: geçici test kullanıcısı oluşturuluyor...\n')
    const { data: user, error: userErr } = await admin.auth.admin.createUser({ email, password: sifre, email_confirm: true })
    if (userErr || !user.user) throw new Error(`Kullanıcı oluşturulamadı: ${userErr?.message}`)
    userId = user.user.id

    const client = createClient(SUPABASE_URL, ANON_KEY)
    const { error: girisErr } = await client.auth.signInWithPassword({ email, password: sifre })
    if (girisErr) throw new Error(`Giriş başarısız: ${girisErr.message}`)

    // Bu noktadan sonra userId her zaman dolu (üstteki throw'lar garanti ediyor) —
    // TypeScript'in bunu otomatik anlaması için ayrı, non-null bir değişkene alıyoruz.
    const guvenliUserId: string = userId!

    // --- SENARYO 1: Tam tahsilat ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 10000)
      olusturulanReceivableIds.push(r.id)
      const { data, error } = await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 10000 })
      const sonuc = data?.[0]
      const { data: guncel } = await admin.from('receivables').select('*').eq('id', r.id).single()
      const { count: paymentSayisi } = await admin.from('receivable_payments').select('*', { count: 'exact', head: true }).eq('receivable_id', r.id)

      const dogru = !error && guncel?.remaining_amount === 0 && guncel?.status === 'completed'
        && guncel?.closed_at !== null && sonuc?.transaction_id && paymentSayisi === 1
      kaydet('1. Tam tahsilat', dogru,
        `remaining=${guncel?.remaining_amount}, status=${guncel?.status}, closed_at=${guncel?.closed_at ? 'dolu' : 'boş'}, transaction=${sonuc?.transaction_id ? 'var' : 'yok'}, payment_sayisi=${paymentSayisi}`)
    }

    // --- SENARYO 2: Kısmi tahsilat ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 10000)
      olusturulanReceivableIds.push(r.id)
      await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 3000 })
      const { data: guncel } = await admin.from('receivables').select('*').eq('id', r.id).single()

      const dogru = guncel?.remaining_amount === 7000 && guncel?.status === 'pending' && guncel?.closed_at === null
      kaydet('2. Kısmi tahsilat', dogru,
        `remaining=${guncel?.remaining_amount} (beklenen: 7000), status=${guncel?.status}, closed_at=${guncel?.closed_at ? 'dolu (YANLIŞ)' : 'boş'}`)
    }

    // --- SENARYO 3: Fazla tahsilat denemesi ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 5000)
      olusturulanReceivableIds.push(r.id)
      const { data: oncekiTx } = await admin.from('transactions').select('id').eq('receivable_id', r.id)

      const { error } = await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 6000 })
      const { data: guncel } = await admin.from('receivables').select('*').eq('id', r.id).single()
      const { count: paymentSayisi } = await admin.from('receivable_payments').select('*', { count: 'exact', head: true }).eq('receivable_id', r.id)

      const dogru = !!error && guncel?.remaining_amount === 5000 && paymentSayisi === 0
      kaydet('3. Fazla tahsilat reddi', dogru,
        `hata=${error ? 'döndü (doğru)' : 'DÖNMEDİ (YANLIŞ)'}, remaining=${guncel?.remaining_amount} (beklenen: 5000, değişmemeli), payment_sayisi=${paymentSayisi} (beklenen: 0)`)
    }

    // --- SENARYO 4: İptal edilmiş receivable'a tahsilat denemesi ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 8000, 'cancelled')
      olusturulanReceivableIds.push(r.id)
      const { error } = await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 1000 })
      const { data: guncel } = await admin.from('receivables').select('*').eq('id', r.id).single()
      const { count: paymentSayisi } = await admin.from('receivable_payments').select('*', { count: 'exact', head: true }).eq('receivable_id', r.id)

      const dogru = !!error && guncel?.remaining_amount === 8000 && guncel?.status === 'cancelled' && paymentSayisi === 0
      kaydet('4. İptal edilmiş kayda tahsilat reddi', dogru,
        `hata=${error ? 'döndü (doğru)' : 'DÖNMEDİ (YANLIŞ)'}, remaining=${guncel?.remaining_amount}, status=${guncel?.status}, payment_sayisi=${paymentSayisi}`)
    }

    // --- SENARYO 5: Ardışık iki kısmi tahsilat ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 10000)
      olusturulanReceivableIds.push(r.id)
      await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 4000 })
      const { data: araGuncel } = await admin.from('receivables').select('*').eq('id', r.id).single()
      const { data: sonSonucData } = await client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 6000 })
      const { data: sonGuncel } = await admin.from('receivables').select('*').eq('id', r.id).single()

      const dogru = araGuncel?.remaining_amount === 6000 && sonGuncel?.remaining_amount === 0 && sonGuncel?.status === 'completed'
      kaydet('5. Ardışık iki kısmi tahsilat', dogru,
        `1. tahsilat sonrası=${araGuncel?.remaining_amount} (beklenen: 6000), 2. tahsilat sonrası=${sonGuncel?.remaining_amount} (beklenen: 0), son status=${sonGuncel?.status}`)
    }

    // --- SENARYO 6: Race condition (eşzamanlı iki istek) ---
    {
      const r = await yeniReceivableOlustur(guvenliUserId, 10000)
      olusturulanReceivableIds.push(r.id)
      // İki istek de 6000 istiyor — toplamda 12000, kalan sadece 10000. FOR UPDATE kilidi
      // doğru çalışıyorsa: biri başarılı olur (remaining 4000'e düşer), diğeri "kalan tutardan
      // büyük" hatası alır (çünkü ikinci istek başlarken kilit açılmış, güncel kalan 4000'i görür).
      const [sonuc1, sonuc2] = await Promise.allSettled([
        client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 6000 }),
        client.rpc('receivable_payment_kaydet', { p_receivable_id: r.id, p_amount: 6000 }),
      ])

      const basari1 = sonuc1.status === 'fulfilled' && !sonuc1.value.error
      const basari2 = sonuc2.status === 'fulfilled' && !sonuc2.value.error
      const { data: guncel } = await admin.from('receivables').select('*').eq('id', r.id).single()
      const { count: paymentSayisi } = await admin.from('receivable_payments').select('*', { count: 'exact', head: true }).eq('receivable_id', r.id)

      // Doğru davranış: TAM OLARAK biri başarılı, kalan tutar 4000, tek payment kaydı var.
      const sadeceBiriBasarili = basari1 !== basari2
      const dogru = sadeceBiriBasarili && guncel?.remaining_amount === 4000 && paymentSayisi === 1
      kaydet('6. Race condition (eşzamanlı istek)', dogru,
        `istek1=${basari1 ? 'başarılı' : 'reddedildi'}, istek2=${basari2 ? 'başarılı' : 'reddedildi'}, remaining=${guncel?.remaining_amount} (beklenen: 4000), payment_sayisi=${paymentSayisi} (beklenen: 1)`)
    }

    // --- ÖZET ---
    console.log('\n=== TEST ÖZETİ ===')
    const basarisizlar = sonuclar.filter((s) => !s.basarili)
    console.log(`${sonuclar.length - basarisizlar.length}/${sonuclar.length} senaryo başarılı`)
    if (basarisizlar.length > 0) {
      console.log('\nBAŞARISIZ OLANLAR:')
      basarisizlar.forEach((s) => console.log(`  - ${s.senaryo}: ${s.detay}`))
      process.exitCode = 1
    }
  } finally {
    console.log('\nTemizlik yapılıyor...')
    for (const id of olusturulanReceivableIds) {
      await admin.from('receivable_payments').delete().eq('receivable_id', id)
      await admin.from('transactions').delete().eq('receivable_id', id)
      await admin.from('receivables').delete().eq('id', id)
    }
    if (userId) await admin.auth.admin.deleteUser(userId)
    console.log('Temizlik tamamlandı.')
  }
}

main().catch((err) => {
  console.error('BEKLENMEYEN HATA:', err)
  process.exit(1)
})
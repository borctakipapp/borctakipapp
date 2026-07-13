// ============================================================================
// OTOMATIK DOĞRULAMA — partner_ozet_getir (SQL) vs lib/finans-motoru.ts (TS)
// ============================================================================
// Bu script, Aile Bütçesi'nin partner özetini hesaplayan SQL fonksiyonuyla,
// aynı ham veri üzerinde TypeScript Finans Motoru'nun ürettiği sonucu KARŞILAŞTIRIR.
// Amaç: SQL tarafındaki kural (elle senkronize edilmiş) TS tarafından SAPARSA
// bunu otomatik yakalamak — TS'teki iş kuralı değiştiğinde bu script kırmızı yanar.
//
// ÇALIŞTIRMA:
//   npm install -D tsx                     (bir kere)
//   npx tsx scripts/dogrula-partner-ozet.ts
//
// GEREKLİ ORTAM DEĞİŞKENLERİ (.env.local'de zaten var olmalı):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// GÜVENLİK NOTU: Bu script GEÇİCİ test kullanıcıları oluşturur, bilinen veri
// ekler, testi çalıştırır, SONRA HER ŞEYİ TEMİZLER (finally bloğunda garanti
// edilir). Gerçek kullanıcı verisine dokunmaz.
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
import { ayKirilimiHesapla, toplamBorcHesapla, ayAraligiUret } from '../lib/finans-motoru'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('HATA: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env.local\'de tanımlı olmalı.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const zaman = Date.now()
  const requesterEmail = `test-requester-${zaman}@dogrulama.local`
  const partnerEmail = `test-partner-${zaman}@dogrulama.local`
  const sifre = `Test${zaman}!Aa1`

  let requesterId: string | null = null
  let partnerId: string | null = null
  const olusturulanDebtIds: string[] = []
  let baglantiId: string | null = null

  try {
    // --- 1) Geçici test kullanıcıları oluştur ---
    console.log('1) Geçici test kullanıcıları oluşturuluyor...')
    const { data: reqUser, error: reqErr } = await admin.auth.admin.createUser({
      email: requesterEmail, password: sifre, email_confirm: true,
    })
    if (reqErr || !reqUser.user) throw new Error(`Requester kullanıcı oluşturulamadı: ${reqErr?.message}`)
    requesterId = reqUser.user.id

    const { data: partnerUser, error: partErr } = await admin.auth.admin.createUser({
      email: partnerEmail, password: sifre, email_confirm: true,
    })
    if (partErr || !partnerUser.user) throw new Error(`Partner kullanıcı oluşturulamadı: ${partErr?.message}`)
    partnerId = partnerUser.user.id

    // --- 2) Aralarında onaylı Aile Bütçesi bağlantısı kur ---
    console.log('2) Aile Bütçesi bağlantısı kuruluyor...')
    const { data: baglanti, error: baglantiErr } = await admin.from('aile_baglantilari').insert({
      davet_eden_id: requesterId, davet_edilen_id: partnerId,
      davet_edilen_email: partnerEmail, durum: 'onaylandi',
    }).select().single()
    if (baglantiErr || !baglanti) throw new Error(`Bağlantı oluşturulamadı: ${baglantiErr?.message}`)
    baglantiId = baglanti.id

    // --- 3) Partner için BİLİNEN veri ekle (borç + gelir/gider + borç ödemesi) ---
    console.log('3) Test verisi ekleniyor...')
    const bugun = new Date()
    const { baslangic, bitis } = ayAraligiUret(bugun.getFullYear(), bugun.getMonth(), 0)
    const ayIciTarih = `${baslangic.slice(0, 8)}10` // ayın 10'u — her zaman ay içinde kalır

    // Aktif borç: 50.000 kalan
    const { data: debt, error: debtErr } = await admin.from('debts').insert({
      user_id: partnerId, category: 'ihtiyac_kredisi', institution_name: 'Test Banka',
      total_amount: 50000, remaining_amount: 50000, status: 'active',
      installment_total: 10, installment_remaining: 10,
    }).select().single()
    if (debtErr || !debt) throw new Error(`Borç eklenemedi: ${debtErr?.message}`)
    olusturulanDebtIds.push(debt.id)

    // Bu ay: 10.000 gelir, 3.000 gider (transactions)
    const { error: txErr } = await admin.from('transactions').insert([
      { user_id: partnerId, type: 'income', category: 'Maaş', amount: 10000, transaction_date: ayIciTarih },
      { user_id: partnerId, type: 'expense', category: 'Market/Gıda', amount: 3000, transaction_date: ayIciTarih },
    ])
    if (txErr) throw new Error(`İşlem eklenemedi: ${txErr.message}`)

    // Bu ay: 2.000 borç ödemesi (payments)
    const { error: payErr } = await admin.from('payments').insert({
      debt_id: debt.id, amount: 2000, paid_at: `${ayIciTarih}T12:00:00`,
    })
    if (payErr) throw new Error(`Ödeme eklenemedi: ${payErr.message}`)

    // Birikim: 5.000
    const { error: hedefErr } = await admin.from('savings_goals').insert({
      user_id: partnerId, goal_name: 'Test Hedef', current_amount: 5000, target_amount: 20000,
    })
    if (hedefErr) throw new Error(`Hedef eklenemedi: ${hedefErr.message}`)

    // --- 4) SQL fonksiyonunu ÇAĞIR (requester olarak oturum açıp) ---
    console.log('4) partner_ozet_getir SQL fonksiyonu çağrılıyor...')
    const requesterClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error: girisErr } = await requesterClient.auth.signInWithPassword({ email: requesterEmail, password: sifre })
    if (girisErr) throw new Error(`Requester girişi başarısız: ${girisErr.message}`)

    const { data: sqlSonuc, error: rpcErr } = await requesterClient.rpc('partner_ozet_getir', { _partner_id: partnerId })
    if (rpcErr || !sqlSonuc || !sqlSonuc[0]) throw new Error(`RPC çağrısı başarısız: ${rpcErr?.message}`)
    const sql = sqlSonuc[0]

    // --- 5) AYNI ham veriden TS Finans Motoru ile bağımsız hesapla ---
    console.log('5) TypeScript Finans Motoru ile bağımsız hesaplanıyor...')
    const { data: debtsData } = await admin.from('debts').select('*').eq('user_id', partnerId)
    const { data: txData } = await admin.from('transactions').select('type, category, amount, transaction_date').eq('user_id', partnerId)
    const { data: payData } = await admin.from('payments').select('amount, paid_at').eq('debt_id', debt.id)
    const { data: hedeflerData } = await admin.from('savings_goals').select('current_amount').eq('user_id', partnerId)

    const tsToplamBorc = toplamBorcHesapla(debtsData || [])
    const tsKirilim = ayKirilimiHesapla(txData || [], payData || [], baslangic, bitis)
    const tsToplamBirikim = (hedeflerData || []).reduce((s, h) => s + Number(h.current_amount), 0)

    // --- 6) Karşılaştır ---
    console.log('\n=== SONUÇ KARŞILAŞTIRMASI ===')
    const satirlar = [
      { alan: 'toplam_borc', sql: Number(sql.toplam_borc), ts: tsToplamBorc },
      { alan: 'bu_ay_net', sql: Number(sql.bu_ay_net), ts: tsKirilim.net },
      { alan: 'toplam_birikim', sql: Number(sql.toplam_birikim), ts: tsToplamBirikim },
    ]

    let hataVar = false
    for (const s of satirlar) {
      const uyusuyor = Math.abs(s.sql - s.ts) < 0.01
      console.log(`${uyusuyor ? '✅' : '❌'} ${s.alan}: SQL=${s.sql} | TS=${s.ts}`)
      if (!uyusuyor) hataVar = true
    }

    if (hataVar) {
      console.error('\n❌ SAPMA TESPİT EDİLDİ — SQL fonksiyonu ile TS motoru farklı sonuç üretiyor. partner_ozet_getir SQL fonksiyonunu lib/finans-motoru.ts ile yeniden senkronize et.')
      process.exitCode = 1
    } else {
      console.log('\n✅ Tüm alanlar eşleşiyor — SQL ve TS senkron.')
    }
  } finally {
    // --- 7) Temizlik — HER durumda çalışır (test başarılı/başarısız fark etmez) ---
    console.log('\n6) Test verisi temizleniyor...')
    if (baglantiId) await admin.from('aile_baglantilari').delete().eq('id', baglantiId)
    for (const id of olusturulanDebtIds) await admin.from('debts').delete().eq('id', id)
    if (partnerId) {
      await admin.from('savings_goals').delete().eq('user_id', partnerId)
      await admin.from('transactions').delete().eq('user_id', partnerId)
      await admin.auth.admin.deleteUser(partnerId)
    }
    if (requesterId) await admin.auth.admin.deleteUser(requesterId)
    console.log('Temizlik tamamlandı.')
  }
}

main().catch((err) => {
  console.error('BEKLENMEYEN HATA:', err)
  process.exit(1)
})
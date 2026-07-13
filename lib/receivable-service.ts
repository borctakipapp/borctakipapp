// ============================================================================
// RECEIVABLE SERVİS KATMANI
// ============================================================================
// UI bu dosyayı çağırır, doğrudan Supabase RPC'sini çağırmaz. Böylece "tahsilat
// kaydetme" mantığı (parametre şekli, hata çevirisi) TEK yerde kalır — ileride
// RPC imzası değişirse sadece bu dosya güncellenir, her UI bileşeni değil.
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

export type TahsilatSonucu =
  | { basarili: true; yeniKalanTutar: number; yeniDurum: 'pending' | 'completed'; receivablePaymentId: string; transactionId: string }
  | { basarili: false; hata: string }

// Tek bir alacağa kısmi ya da tam tahsilat kaydeder. Atomik RPC'yi (receivable_payment_kaydet)
// çağırır — hem tahsilat satırı, hem alacağın kalan tutarı/durumu, hem karşılık gelen
// gelir kaydı TEK işlemde oluşturulur (herhangi biri başarısız olursa hepsi geri alınır).
export async function tahsilatKaydet(
  receivableId: string,
  tutar: number,
  tarih: Date = new Date(),
): Promise<TahsilatSonucu> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('receivable_payment_kaydet', {
    p_receivable_id: receivableId,
    p_amount: tutar,
    p_paid_at: tarih.toISOString(),
  })

  if (error) {
    return { basarili: false, hata: hataMesajiCevir(error) }
  }

  const sonuc = data?.[0]
  if (!sonuc) {
    return { basarili: false, hata: 'Beklenmeyen bir sorun oluştu, tekrar dener misin?' }
  }

  return {
    basarili: true,
    yeniKalanTutar: Number(sonuc.yeni_kalan_tutar),
    yeniDurum: sonuc.yeni_durum,
    receivablePaymentId: sonuc.receivable_payment_id,
    transactionId: sonuc.transaction_id,
  }
}

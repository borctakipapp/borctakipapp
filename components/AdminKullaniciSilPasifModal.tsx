'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OnayModal from './OnayModal'
import { useToast } from './Toast'
import { kullaniciPasifEt, kullaniciAktifEt, kullaniciKaliciSil } from '@/lib/admin-kullanici-actions'

export default function AdminKullaniciSilPasifModal({ userId, pasifMi, email }: { userId: string; pasifMi: boolean; email: string }) {
  const router = useRouter()
  const { goster } = useToast()
  const [onayPasifAcik, setOnayPasifAcik] = useState(false)
  const [onaySilAcik, setOnaySilAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function pasifDurumDegistir() {
    setOnayPasifAcik(false)
    setYukleniyor(true)
    const sonuc = pasifMi ? await kullaniciAktifEt(userId) : await kullaniciPasifEt(userId)
    setYukleniyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster(pasifMi ? 'Kullanıcı yeniden aktif edildi.' : 'Kullanıcı pasif edildi.')
    router.refresh()
  }

  async function kaliciSil() {
    setOnaySilAcik(false)
    setYukleniyor(true)
    const sonuc = await kullaniciKaliciSil(userId)
    setYukleniyor(false)
    if (sonuc.hata) { goster(sonuc.hata, 'hata'); return }
    goster('Kullanıcı kalıcı olarak silindi.')
    router.push('/admin/kullanicilar')
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setOnayPasifAcik(true)} disabled={yukleniyor}
          className="text-xs text-amber underline disabled:opacity-50">
          {pasifMi ? 'Yeniden Aktif Et' : 'Pasif Et (Giriş Engelle)'}
        </button>
        <button onClick={() => setOnaySilAcik(true)} disabled={yukleniyor}
          className="text-xs text-brick underline disabled:opacity-50">
          Kalıcı Olarak Sil
        </button>
      </div>

      <OnayModal
        acik={onayPasifAcik}
        baslik={pasifMi ? 'Kullanıcıyı yeniden aktif et' : 'Kullanıcıyı pasif et'}
        mesaj={pasifMi
          ? `${email} tekrar giriş yapabilsin mi?`
          : `${email} artık giriş yapamayacak. Verileri silinmez, istediğin zaman geri açabilirsin.`}
        onayMetni={pasifMi ? 'Evet, Aktif Et' : 'Evet, Pasif Et'}
        tehlikeli={!pasifMi}
        onOnayla={pasifDurumDegistir}
        onVazgec={() => setOnayPasifAcik(false)}
      />

      <OnayModal
        acik={onaySilAcik}
        baslik="Kalıcı olarak sil"
        mesaj={`${email} hesabını ve TÜM verilerini (borç, gelir-gider, birikim, grup üyelikleri) kalıcı olarak silmek istediğine emin misin? Bu işlem GERİ ALINAMAZ.`}
        onayMetni="Evet, Kalıcı Olarak Sil"
        onOnayla={kaliciSil}
        onVazgec={() => setOnaySilAcik(false)}
      />
    </>
  )
}

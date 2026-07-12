'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TURKIYE_IL_ILCE, TURKIYE_ILLERI } from '@/lib/turkiye-il-ilce'
import Secim from './Secim'
import Modal from './Modal'
import { hataMesajiCevir } from '@/lib/hata-mesaji'

const CINSIYET_SECENEKLERI = ['Kadın', 'Erkek', 'Belirtmek istemiyorum']
const GELIR_ARALIKLARI = ['15.000 ₺ altı', '15.000 - 25.000 ₺', '25.000 - 40.000 ₺', '40.000 - 60.000 ₺', '60.000 ₺ ve üzeri', 'Belirtmek istemiyorum']

export default function ProfilModal({ tetikleyici }: { tetikleyici: React.ReactNode }) {
  const supabase = createClient()
  const [acik, setAcik] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')

  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [il, setIl] = useState('')
  const [ilce, setIlce] = useState('')
  const [gender, setGender] = useState('')
  const [incomeRange, setIncomeRange] = useState('')
  const [householdSize, setHouseholdSize] = useState('')

  useEffect(() => {
    if (!acik) return
    async function fetchProfil() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setFullName(data.full_name || ''); setBirthDate(data.birth_date || ''); setPhone(data.phone || '')
        if (data.city) {
          const parcalar = data.city.split(', ')
          setIl(parcalar[0] || ''); setIlce(parcalar[1] || '')
        }
        setGender(data.gender || ''); setIncomeRange(data.income_range || '')
        setHouseholdSize(data.household_size ? String(data.household_size) : '')
      }
      setLoading(false)
    }
    fetchProfil()
  }, [acik])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(''); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id, full_name: fullName || null, birth_date: birthDate || null, phone: phone || null,
      city: il ? (ilce ? `${il}, ${ilce}` : il) : null, gender: gender || null,
      income_range: incomeRange || null, household_size: householdSize ? parseInt(householdSize) : null,
    })

    setSaving(false)
    setMessage(error ? hataMesajiCevir(error) : 'Kaydedildi.')
  }

  return (
    <>
      <span onClick={() => setAcik(true)} className="contents cursor-pointer">{tetikleyici}</span>

      <Modal acik={acik} baslik="Profilim" onKapat={() => setAcik(false)}>
        {loading ? (
          <p className="text-sm text-muted text-center py-6">Yükleniyor...</p>
        ) : (
          <>
            <p className="text-sm text-muted mb-1">{email}</p>
            <p className="text-xs text-muted mb-4">
              Bu bilgilerin tamamı opsiyoneldir. Deneyimini kişiselleştirmek ve genel istatistikler için kullanılır.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Ad Soyad</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Doğum Tarihi</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Telefon</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">İl</label>
                <Secim value={il} onChange={(e) => { setIl(e.target.value); setIlce('') }}>
                  <option value="">Seçilmedi</option>
                  {TURKIYE_ILLERI.map((i) => <option key={i} value={i}>{i}</option>)}
                </Secim>
              </div>
              {il && (
                <div>
                  <label className="text-xs text-muted mb-1 block">İlçe</label>
                  <Secim value={ilce} onChange={(e) => setIlce(e.target.value)}>
                    <option value="">Seçilmedi</option>
                    {(TURKIYE_IL_ILCE[il] || []).map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </Secim>
                </div>
              )}
              <div>
                <label className="text-xs text-muted mb-1 block">Cinsiyet</label>
                <Secim value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Seçilmedi</option>
                  {CINSIYET_SECENEKLERI.map((g) => <option key={g} value={g}>{g}</option>)}
                </Secim>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Aylık Gelir Aralığı</label>
                <Secim value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)}>
                  <option value="">Seçilmedi</option>
                  {GELIR_ARALIKLARI.map((g) => <option key={g} value={g}>{g}</option>)}
                </Secim>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Hanede Kaç Kişi Yaşıyor</label>
                <input type="number" min="1" max="15" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white font-mono" />
              </div>
              <button type="submit" disabled={saving}
                className="mt-2 bg-navy text-paper text-sm font-medium rounded-lg py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              {message && <p className={`text-xs mt-1 ${message === 'Kaydedildi.' ? 'text-sage' : 'text-brick'}`}>{message}</p>}
            </form>
          </>
        )}
      </Modal>
    </>
  )
}

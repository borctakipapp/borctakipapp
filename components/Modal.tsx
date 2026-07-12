'use client'

export default function Modal({
  acik, baslik, onKapat, children,
}: {
  acik: boolean
  baslik: string
  onKapat: () => void
  children: React.ReactNode
}) {
  if (!acik) return null

  return (
    <div className="fixed inset-0 bg-navy/40 flex items-end sm:items-center justify-center z-50" onClick={onKapat}>
      <div
        className="bg-paper rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-paper">
          <h2 className="text-base font-medium text-navy">{baslik}</h2>
          <button onClick={onKapat} className="text-muted hover:text-navy text-xl leading-none p-1" aria-label="Kapat">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

'use client'

import { SelectHTMLAttributes, ReactNode } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }

// Native <select>'in üzerine özel görünüm giydiriyor — davranış/erişilebilirlik aynı kalıyor
// (klavye, mobil dokunma vs. tarayıcının kendi mekanizması), sadece görünüm bizim tasarımımıza uyuyor.
export default function Secim({ className = '', children, ...props }: Props) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full px-3 py-2.5 pr-9 border border-border rounded-lg text-sm bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/30 ${className}`}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

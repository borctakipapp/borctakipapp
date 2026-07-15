import AdminHeader from '@/components/AdminHeader'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <AdminHeader />
      {children}
    </div>
  )
}

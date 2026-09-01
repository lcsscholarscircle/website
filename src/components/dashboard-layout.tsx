import Sidebar from './sidebar'

type DashboardLayoutProps = {
  role: 'student' | 'tutor' | 'leader'
  children: React.ReactNode
}

export default function DashboardLayout({
  role,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
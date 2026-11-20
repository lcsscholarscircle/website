
'use client'

import { useEffect, useState } from 'react'
import Sidebar from './sidebar'

type DashboardLayoutProps = {
  role: 'student' | 'tutor' | 'leader'
  children: React.ReactNode
}

export default function DashboardLayout({
  role,
  children,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Restore sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem('scholars-sidebar-collapsed')

    if (saved !== null) {
      setCollapsed(saved === 'true')
    }

    setLoaded(true)
  }, [])

  // Save sidebar preference
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(
        'scholars-sidebar-collapsed',
        String(collapsed)
      )
    }
  }, [collapsed, loaded])

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Sidebar */}
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
      />

      {/* Main Content */}
      <main
        className={`min-h-screen min-w-0 p-4 md:p-8 transition-[margin] duration-300 ease-in-out ${
          collapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        {children}
      </main>

    </div>
  )
}

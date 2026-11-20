
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type SidebarProps = {
  role: 'student' | 'tutor' | 'leader'
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({
  role,
  collapsed,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname()

  // Normalize pathname to avoid trailing-slash issues
  const currentPath = pathname.replace(/\/$/, '') || '/'

  const links = {
    student: [
      { name: 'Dashboard', href: '/student', icon: '⌂' },
      { name: 'Book a Tutor', href: '/student/book', icon: '+' },
      { name: 'My Sessions', href: '/student/sessions', icon: '▤' },
    ],

    tutor: [
      { name: 'Dashboard', href: '/tutor', icon: '⌂' },
      { name: 'Availability', href: '/tutor/availability', icon: '◷' },
      { name: 'Opportunities', href: '/tutor/opportunities', icon: '☆' },
      { name: 'Student Dashboard', href: '/student', icon: '♙' },
    ],

    leader: [
      { name: 'Dashboard', href: '/admin', icon: '⌂' },
      { name: 'Schedule', href: '/admin/schedule', icon: '▦' },
      { name: 'Bookings', href: '/admin/bookings', icon: '▤' },
      { name: 'Requests', href: '/admin/requests', icon: '✉' },
      { name: 'Tutor Dashboard', href: '/tutor', icon: '♙' },
      { name: 'Student Dashboard', href: '/student', icon: '♧' },
    ],
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-white p-4 transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Header / Home Link */}
      <Link
        href="/"
        title="Scholar's Circle Home"
        className="mb-6 flex min-h-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors hover:bg-gray-50"
      >
        {collapsed ? (
          <span className="text-xl font-bold text-green-700">
            SC
          </span>
        ) : (
          <div className="w-full">
            <h1 className="whitespace-nowrap text-xl font-bold">
              Scholar&apos;s Circle
            </h1>

            <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">
              Peer Tutoring Organization
            </p>
          </div>
        )}
      </Link>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden">
        {links[role].map((link) => {
          // Only highlight the exact current page
          const active = currentPath === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.name : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center rounded-lg py-2 text-sm transition-colors ${
                collapsed
                  ? 'justify-center px-1'
                  : 'gap-3 px-3'
              } ${
                active
                  ? 'bg-green-50 font-semibold text-green-800'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg">
                {link.icon}
              </span>

              {!collapsed && (
                <span className="whitespace-nowrap">
                  {link.name}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto shrink-0 space-y-4 border-t pt-5">

        {/* About Button */}
        <Link
          href="/about"
          title={collapsed ? 'About Us' : undefined}
          className={`flex items-center rounded-xl border border-green-200 bg-green-50 text-green-800 shadow-sm transition-all hover:border-green-300 hover:bg-green-100 hover:shadow-md ${
            collapsed
              ? 'justify-center p-2'
              : 'gap-3 px-3 py-3'
          }`}
        >
          <span className="shrink-0 text-lg">ⓘ</span>

          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                About Us
              </p>
              <p className="whitespace-nowrap text-[11px] text-green-700">
                Meet the Scholar&apos;s Circle team
              </p>
            </div>
          )}
        </Link>

        {/* Contact */}
        {!collapsed && (
          <div className="px-2 text-sm">
            <p className="text-muted-foreground">
              Contact us at:
            </p>
            <p className="break-all text-[11px] font-medium">
              scholarscircle@larchmontcharter.org
            </p>
          </div>
        )}

        {/* Collapse / Expand Button */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-10 w-full items-center justify-center rounded-lg border bg-white text-gray-600 transition-colors hover:bg-gray-100"
        >
          <span className="text-lg">
            {collapsed ? '→' : '←'}
          </span>

          {!collapsed && (
            <span className="ml-2 text-sm">
              Collapse Sidebar
            </span>
          )}
        </button>

      </div>
    </aside>
  )
}

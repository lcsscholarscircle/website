
'use client'

import Link from 'next/link'

type SidebarProps = {
  role: 'student' | 'tutor' | 'leader'
}

export default function Sidebar({ role }: SidebarProps) {
  const links = {
    student: [
      { name: 'Dashboard', href: '/student' },
      { name: 'Book a Tutor', href: '/student/book' },
      { name: 'My Sessions', href: '/student/sessions' },
    ],

    tutor: [
      { name: 'Dashboard', href: '/tutor' },
      { name: 'Availability', href: '/tutor/availability' },
      { name: 'Opportunities', href: '/tutor/opportunities' },
      { name: 'Student Dashboard', href: '/student' },
    ],

    leader: [
      { name: 'Dashboard', href: '/admin' },
      { name: 'Schedule', href: '/admin/schedule' },
      { name: 'Bookings', href: '/admin/bookings' },
      { name: 'Requests', href: '/admin/requests' },
      { name: 'Tutor Dashboard', href: '/tutor' },
      { name: 'Student Dashboard', href: '/student' },
    ],
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-white p-6">

      {/* Header */}
      <div className="mb-8 shrink-0">
        <h1 className="text-xl font-bold">
          Scholar&apos;s Circle
        </h1>

        <p className="text-sm text-muted-foreground">
          Peer Tutoring Organization
        </p>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {links[role].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            {link.name}
          </Link>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto shrink-0 pt-6 space-y-5">

        {/* About Button */}
        <Link
          href="/about"
          className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 shadow-sm transition-all hover:bg-green-100 hover:border-green-300 hover:shadow-md dark:border-green-900 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-950/70"
        >
          <div>
            <p className="text-sm font-semibold">
              About Us
            </p>
            <p className="text-[11px] text-green-700 dark:text-green-400">
              Meet the Scholar&apos;s Circle team
            </p>
          </div>
        </Link>

        {/* Contact */}
        <div className="px-3 text-sm">
          <p className="text-muted-foreground">
            Contact us at:
          </p>
          <p className="text-[11px] font-medium whitespace-nowrap">
            scholarscircle@larchmontcharter.org
          </p>
        </div>

      </div>
    </aside>
  )
}

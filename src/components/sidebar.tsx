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
    ],

    leader: [
      { name: 'Dashboard', href: '/admin' },
      { name: 'Schedule', href: '/admin/schedule' },
      { name: 'Requests', href: '/admin/requests' },
    ],
  }

  return (
    <aside className="w-64 border-r bg-white min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold">
          Scholar&apos;s Circle
        </h1>

        <p className="text-sm text-muted-foreground">
          Larchmont Charter School
        </p>
      </div>

      <nav className="space-y-2">
        {links[role].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            {link.name}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <a
          href="mailto:scholarscircle@larchmontcharter.org"
          target="_blank"
          className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
        >
          Contact us
        </a>
      </div>
    </aside>
  )
}
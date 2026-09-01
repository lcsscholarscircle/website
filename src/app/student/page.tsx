'use client'

import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/dashboard-layout'

export default function StudentDashboard() {
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <DashboardLayout role="student">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            Student Dashboard
          </h1>

          <p className="text-muted-foreground mt-1">
            Get help from your fellow LCS students.
          </p>
        </div>

        <button
          onClick={signOut}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-white"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">
          Upcoming Sessions
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have any upcoming sessions.
        </p>
      </div>
    </DashboardLayout>
  )
}
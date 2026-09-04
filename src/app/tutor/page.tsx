'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/dashboard-layout'
import { Badge } from '@/components/ui/badge'

type Booking = {
  id: string
  status: string
  student_id: string
  tutor_id: string

  bookable_sessions: {
    id: string
    session_type: 'lunch' | 'zoom' | 'official'
    session_date: string
    start_time: string
    end_time: string
  } | null

  student: {
    id: string
    name: string
    grade: number | null
  } | null
}

export default function TutorDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')

    /*
     * Get the currently signed-in tutor.
     */

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(
        'Unable to determine the signed-in tutor.'
      )

      setLoading(false)
      return
    }

    /*
     * Load the tutor's bookings.
     */

    const {
      data: bookingData,
      error: bookingsError,
    } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        student_id,
        tutor_id,

        bookable_sessions (
          id,
          session_type,
          session_date,
          start_time,
          end_time
        ),

        student:profiles!bookings_student_id_fkey (
          id,
          name,
          grade
        )
      `)
      .eq('tutor_id', user.id)
      .eq('status', 'confirmed')

    if (bookingsError) {
      console.error(bookingsError)

      setError(bookingsError.message)
      setLoading(false)
      return
    }

    setBookings(
      (bookingData ?? []).map((booking) => ({
        ...booking,
        bookable_sessions: Array.isArray(booking.bookable_sessions)
          ? booking.bookable_sessions[0] ?? null
          : booking.bookable_sessions,
        student: Array.isArray(booking.student)
          ? booking.student[0] ?? null
          : booking.student,
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  /*
   * Only show sessions that haven't happened yet.
   */

  const upcomingBookings = bookings
    .filter((booking) => {
      const session = booking.bookable_sessions

      if (!session) {
        return false
      }

      const sessionDateTime = new Date(
        `${session.session_date}T${session.start_time}`
      )

      return sessionDateTime >= new Date()
    })
    .sort((a, b) => {
      const aSession = a.bookable_sessions!
      const bSession = b.bookable_sessions!

      const aTime = new Date(
        `${aSession.session_date}T${aSession.start_time}`
      ).getTime()

      const bTime = new Date(
        `${bSession.session_date}T${bSession.start_time}`
      ).getTime()

      return aTime - bTime
    })

  if (loading) {
    return (
      <DashboardLayout role="tutor">
        <div className="mx-auto max-w-6xl">
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Loading your dashboard...
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="tutor">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Tutor Dashboard
            </h1>

            <p className="mt-1 text-muted-foreground">
              Help your fellow LCS students succeed.
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-white"
          >
            Sign out
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* UPCOMING SESSIONS */}

        <section className="rounded-2xl border bg-white shadow-sm">

          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h2 className="text-lg font-semibold">
                Upcoming Sessions
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Your scheduled Scholar&apos;s Circle sessions.
              </p>
            </div>

            {upcomingBookings.length > 0 && (
              <Badge variant="secondary">
                {upcomingBookings.length}{' '}
                {upcomingBookings.length === 1
                  ? 'session'
                  : 'sessions'}
              </Badge>
            )}
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="p-8 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                📚
              </div>

              <h3 className="mt-4 font-semibold">
                No upcoming sessions
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                You don&apos;t have any tutoring sessions
                scheduled yet.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {upcomingBookings.map((booking) => (
                <TutorBookingCard
                  key={booking.id}
                  booking={booking}
                />
              ))}
            </div>
          )}

        </section>
      {/* UPDATE AVAILABILITY */}

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            window.location.href =
              '/tutor/availability'
          }}
          className="w-full rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
              🗓️
            </div>

            <div>
              <p className="font-semibold">
                Update My Availability
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Choose when you&apos;re available to tutor.
              </p>
            </div>
          </div>
        </button>
      </div>
      </div>
    </DashboardLayout>
  )
}

/*
 * Individual tutor booking card.
 */

function TutorBookingCard({
  booking,
}: {
  booking: Booking
}) {
  const session = booking.bookable_sessions
  const student = booking.student

  if (!session) {
    return null
  }

  return (
    <div className="p-6 transition hover:bg-muted/20">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

        {/* SESSION INFO */}

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              {formatSessionType(
                session.session_type
              )}
            </Badge>

            <Badge variant="secondary">
              Booked
            </Badge>
          </div>

          <h3 className="mt-3 text-lg font-semibold">
            {formatDate(session.session_date)}
          </h3>

          <p className="mt-1 text-base">
            {formatTime(session.start_time)}
            {' – '}
            {formatTime(session.end_time)}
          </p>

          {student && (
            <p className="mt-2 text-sm text-muted-foreground">
              with{' '}
              <span className="font-medium text-foreground">
                {student.name}
              </span>

              {student.grade && (
                <>
                  {' · Grade '}
                  {student.grade}
                </>
              )}
            </p>
          )}

        </div>

      </div>
    </div>
  )
}

function formatSessionType(
  type: 'lunch' | 'zoom' | 'official'
) {
  switch (type) {
    case 'lunch':
      return 'Lunch'

    case 'zoom':
      return 'Zoom'

    case 'official':
      return 'Official Session'

    default:
      return type
  }
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':')

  const date = new Date()

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  )

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(date: string) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}
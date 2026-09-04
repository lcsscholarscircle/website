'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Booking = {
  id: string
  session_id: string
  student_id: string
  tutor_id: string
  status: string
  bookable_sessions: {
    id: string
    session_type: 'lunch' | 'zoom' | 'official'
    session_date: string
    start_time: string
    end_time: string
  } | null
  tutor: {
    id: string
    name: string
    grade: number | null
  } | null
}

type Subject = {
  id: string
  name: string
}

export default function StudentDashboard() {
  const [bookings, setBookings] =
    useState<Booking[]>([])

  const [subjects, setSubjects] =
    useState<Subject[]>([])

  const [studentSubjects, setStudentSubjects] =
    useState<string[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [cancelling, setCancelling] =
  useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setError('')

    /*
     * Get the currently signed-in student.
     */

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(
        'Unable to determine the signed-in student.'
      )

      setLoading(false)
      return
    }

    /*
     * Load the student's profile.
     */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('subjects')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(profileError)
      setError(profileError.message)
    }

    /*
     * Load subjects so we can eventually use them
     * elsewhere on the dashboard.
     */

    const {
      data: subjectData,
      error: subjectsError,
    } = await supabase
      .from('subjects')
      .select('id, name')
      .order('name')

    if (subjectsError) {
      console.error(subjectsError)
    }

    /*
     * Load the student's bookings.
     *
     * The embedded relationships come from:
     *
     * bookings.session_id
     * bookings.tutor_id
     */

    const {
      data: bookingData,
      error: bookingsError,
    } = await supabase
      .from('bookings')
      .select(`
        id,
        session_id,
        student_id,
        tutor_id,
        status,

        bookable_sessions (
          id,
          session_type,
          session_date,
          start_time,
          end_time
        ),

        tutor:profiles!bookings_tutor_id_fkey (
          id,
          name,
          grade
        )
      `)
      .eq('student_id', user.id)

    if (bookingsError) {
      console.error('BOOKINGS ERROR:', bookingsError)

      setError(
        bookingsError.message ||
          'Unable to load your bookings.'
      )

      setLoading(false)
      return
    }

    console.log('BOOKINGS:', bookingData)

    setBookings(
      (bookingData ?? []).map((booking) => ({
        ...booking,
        bookable_sessions: Array.isArray(booking.bookable_sessions)
          ? booking.bookable_sessions[0] ?? null
          : booking.bookable_sessions,
        tutor: Array.isArray(booking.tutor)
          ? booking.tutor[0] ?? null
          : booking.tutor,
      }))
    )

    setSubjects(
      subjectData || []
    )

    setStudentSubjects(
      profile?.subjects || []
    )

    setLoading(false)
  }

  async function cancelBooking(
    bookingId: string
  ) {
    setError('')

    const confirmed =
      window.confirm(
        'Are you sure you want to cancel this tutoring session?'
      )

    if (!confirmed) {
      return
    }

    setCancelling(bookingId)

    const {
      error: cancelError,
    } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
      })
      .eq('id', bookingId)

    if (cancelError) {
      console.error(cancelError)

      setError(
        cancelError.message ||
          'Unable to cancel this session.'
      )

      setCancelling(null)
      return
    }

    /*
    * The booking has been successfully cancelled.
    * Now ask the server to notify the tutor.
    */

    const notificationResponse = await fetch(
      '/api/notifications/booking-cancelled',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
        }),
      }
    )

    if (!notificationResponse.ok) {
      const notificationError =
        await notificationResponse.json()

      console.error(
        'Notification error:',
        notificationError
      )

      /*
      * The cancellation itself succeeded, so we don't
      * want to tell the student that the cancellation failed.
      *
      * The server-side notification system can be retried
      * later.
      */
    }

    setCancelling(null)

    /*
    * INSTEAD OF removing the booking from the local page immediately, we just reload the dashboard.
    */

    await loadDashboard()
  }
  
  useEffect(() => {
    loadDashboard()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  /*
   * Only show sessions that haven't happened yet and that aren't cancelled.
   */

  const upcomingBookings =
    bookings.filter((booking) => {
      if (booking.status === 'cancelled') {
        return false
      }

      const session = booking.bookable_sessions

      if (!session) {
        return false
      }

      const sessionDateTime = new Date(
        `${session.session_date}T${session.start_time}`
      )

      return sessionDateTime >= new Date()
    })

  /*
   * Sort upcoming sessions chronologically.
   */

  upcomingBookings.sort(
    (a, b) => {
      const aSession =
        a.bookable_sessions!

      const bSession =
        b.bookable_sessions!

      const aTime =
        new Date(
          `${aSession.session_date}T${aSession.start_time}`
        ).getTime()

      const bTime =
        new Date(
          `${bSession.session_date}T${bSession.start_time}`
        ).getTime()

      return aTime - bTime
    }
  )

  if (loading) {
    return (
      <DashboardLayout role="student">
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
    <DashboardLayout role="student">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Student Dashboard
            </h1>

            <p className="mt-1 text-muted-foreground">
              Get help from your fellow LCS students.
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg border bg-white px-4 py-2 text-sm transition hover:bg-muted"
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

              <Button
                className="mt-5"
                onClick={() => {
                  window.location.href =
                    '/student/book'
                }}
              >
                Book a Tutor
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {upcomingBookings.map(
                (booking) => {
                  const session =
                    booking.bookable_sessions

                  if (!session) {
                    return null
                  }

                  return (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onCancel={cancelBooking}
                      cancelling={cancelling}
                    />
                  )
                }
              )}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">

          <button
            type="button"
            onClick={() => {
              window.location.href =
                '/student/book'
            }}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                📖
              </div>

              <div>
                <p className="font-semibold">
                  Book a Tutor
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Find help with a subject.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href =
                '/student/bookings'
            }}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                📅
              </div>

              <div>
                <p className="font-semibold">
                  My Sessions
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  View your complete booking history.
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
 * Individual booking card.
 */

function BookingCard({
  booking,
  onCancel,
  cancelling,
}: {
  booking: Booking
  onCancel: (bookingId: string) => void
  cancelling: string | null
}) {
  const session =
    booking.bookable_sessions

  const tutor =
    booking.tutor

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
          </div>

          <h3 className="mt-3 text-lg font-semibold">
            {formatDate(
              session.session_date
            )}
          </h3>

          <p className="mt-1 text-base">
            {formatTime(
              session.start_time
            )}
            {' – '}
            {formatTime(
              session.end_time
            )}
          </p>

          {tutor && (
            <p className="mt-2 text-sm text-muted-foreground">
              with{' '}
              <span className="font-medium text-foreground">
                {tutor.name}
              </span>

              {tutor.grade && (
                <>
                  {' · Grade '}
                  {tutor.grade}
                </>
              )}
            </p>
          )}
        </div>

        {/* ACTIONS */}

        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="whitespace-nowrap"
          >
            Booked
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onCancel(booking.id)
            }
            disabled={
              cancelling === booking.id
            }
          >
            {cancelling === booking.id
              ? 'Cancelling...'
              : 'Cancel'}
          </Button>
        </div>

      </div>
    </div>
  )
}

function formatSessionType(
  type:
    | 'lunch'
    | 'zoom'
    | 'official'
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

function formatTime(
  time: string
) {
  const [
    hours,
    minutes,
  ] = time.split(':')

  const date =
    new Date()

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  )

  return date.toLocaleTimeString(
    [],
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}

function formatDate(
  date: string
) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    [],
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }
  )
}
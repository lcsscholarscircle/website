'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/dashboard-layout'
import { Badge } from '@/components/ui/badge'

type Session = {
  id: string
  status: string
  student_id: string
  tutor_id: string

  bookable_sessions: {
    id: string
    session_type: 'lunch' | 'official' | 'zoom'
    session_date: string
    start_time: string
    end_time: string
  } | null

  tutor: {
    id: string
    name: string
    email: string
  } | null
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }
  )
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getSessionDateTime(
  session: Session['bookable_sessions']
) {
  if (!session) return null

  return new Date(
    `${session.session_date}T${session.start_time}`
  )
}

function getSessionTypeLabel(
  sessionType: 'lunch' | 'official' | 'zoom'
) {
  switch (sessionType) {
    case 'lunch':
      return 'Lunch'
    case 'zoom':
      return 'Zoom'
    case 'official':
      return 'Official Session'
    default:
      return sessionType
  }
}

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
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
        tutor:profiles!bookings_tutor_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('student_id', user.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
    } else {
    const formattedSessions: Session[] = (data ?? []).map(
        (booking) => ({
        id: booking.id,
        status: booking.status,
        student_id: booking.student_id,
        tutor_id: booking.tutor_id,

        bookable_sessions:
            Array.isArray(booking.bookable_sessions)
            ? booking.bookable_sessions[0] ?? null
            : booking.bookable_sessions ?? null,

        tutor:
            Array.isArray(booking.tutor)
            ? booking.tutor[0] ?? null
            : booking.tutor ?? null,
        })
    )

    setSessions(formattedSessions)
    }

    setLoading(false)
  }

  const now = new Date()

  const upcomingSessions = sessions
    .filter((booking) => {
      if (booking.status === 'cancelled') return false

      const sessionDate = getSessionDateTime(
        booking.bookable_sessions
      )

      return sessionDate !== null && sessionDate >= now
    })
    .sort((a, b) => {
      const dateA = getSessionDateTime(a.bookable_sessions)
      const dateB = getSessionDateTime(b.bookable_sessions)

      if (!dateA || !dateB) return 0

      return dateA.getTime() - dateB.getTime()
    })

  const pastSessions = sessions
    .filter((booking) => {
      if (booking.status === 'cancelled') return false

      const sessionDate = getSessionDateTime(
        booking.bookable_sessions
      )

      return sessionDate !== null && sessionDate < now
    })
    .sort((a, b) => {
      const dateA = getSessionDateTime(a.bookable_sessions)
      const dateB = getSessionDateTime(b.bookable_sessions)

      if (!dateA || !dateB) return 0

      return dateB.getTime() - dateA.getTime()
    })

  const cancelledSessions = sessions
    .filter((booking) => booking.status === 'cancelled')
    .sort((a, b) => {
      const dateA = getSessionDateTime(a.bookable_sessions)
      const dateB = getSessionDateTime(b.bookable_sessions)

      if (!dateA || !dateB) return 0

      return dateB.getTime() - dateA.getTime()
    })

  function SessionCard({
    booking,
  }: {
    booking: Session
  }) {
    const session = booking.bookable_sessions

    if (!session) return null

    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary">
              {getSessionTypeLabel(session.session_type)}
            </Badge>

            <h3 className="mt-3 text-lg font-semibold">
              {booking.tutor?.name ?? 'Tutor'}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(session.session_date)}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {formatTime(session.start_time)} -{' '}
              {formatTime(session.end_time)}
            </p>
          </div>

          {booking.status === 'cancelled' && (
            <Badge variant="destructive">
              Cancelled
            </Badge>
          )}
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout role="student">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* HEADER */}

        <div>
          <h1 className="text-3xl font-bold">
            My Sessions
          </h1>

          <p className="mt-2 text-muted-foreground">
            View your upcoming and past Scholar&apos;s Circle
            tutoring sessions.
          </p>
        </div>

        {/* UPCOMING */}

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Upcoming Sessions
            </h2>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">
              Loading your sessions...
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
              <div className="text-3xl">📚</div>

              <h3 className="mt-3 font-semibold">
                No upcoming sessions
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                You don&apos;t have any upcoming tutoring
                sessions scheduled.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/student/book'
                }}
                className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Book a Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((booking) => (
                <SessionCard
                  key={booking.id}
                  booking={booking}
                />
              ))}
            </div>
          )}
        </section>

        {/* PAST */}

        {!loading && pastSessions.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Past Sessions
              </h2>
            </div>

            <div className="space-y-4">
              {pastSessions.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm opacity-75"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge variant="outline">
                        {getSessionTypeLabel(
                          booking.bookable_sessions
                            ?.session_type ?? 'official'
                        )}
                      </Badge>

                      <h3 className="mt-3 text-lg font-semibold">
                        {booking.tutor?.name ?? 'Tutor'}
                      </h3>

                      {booking.bookable_sessions && (
                        <>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(
                              booking.bookable_sessions
                                .session_date
                            )}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatTime(
                              booking.bookable_sessions
                                .start_time
                            )}{' '}
                            -{' '}
                            {formatTime(
                              booking.bookable_sessions
                                .end_time
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    <Badge variant="outline">
                      Completed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CANCELLED */}

        {!loading && cancelledSessions.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Cancelled Sessions
              </h2>
            </div>

            <div className="space-y-4">
              {cancelledSessions.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm opacity-60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge variant="outline">
                        {getSessionTypeLabel(
                          booking.bookable_sessions
                            ?.session_type ?? 'official'
                        )}
                      </Badge>

                      <h3 className="mt-3 text-lg font-semibold">
                        {booking.tutor?.name ?? 'Tutor'}
                      </h3>

                      {booking.bookable_sessions && (
                        <>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(
                              booking.bookable_sessions
                                .session_date
                            )}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatTime(
                              booking.bookable_sessions
                                .start_time
                            )}{' '}
                            -{' '}
                            {formatTime(
                              booking.bookable_sessions
                                .end_time
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    <Badge variant="destructive">
                      Cancelled
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
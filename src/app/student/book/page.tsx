'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Subject = {
  id: string
  name: string
}

type Tutor = {
  id: string
  name: string
  email: string
  grade: number | null
  subjects: string[] | null
}

type AvailabilityRule = {
  id: string
  tutor_id: string
}

type BookableSession = {
  id: string
  availability_rule_id: string
  schedule_window_id: string | null
  session_type: 'lunch' | 'zoom' | 'official'
  session_date: string
  start_time: string
  end_time: string
  slot_index: number
}

type Booking = {
  id: string
  session_id: string
  student_id: string
  tutor_id: string
}

const sessionTypeLabels = {
  lunch: 'Lunch',
  zoom: 'Zoom',
  official: 'Official Session',
}

const sessionTypeDescriptions = {
  lunch: 'During lunch',
  zoom: 'Online',
  official: 'School tutoring session',
}

export default function BookPage() {
  const [subjects, setSubjects] =
    useState<Subject[]>([])

  const [tutors, setTutors] =
    useState<Tutor[]>([])

  const [availabilityRules, setAvailabilityRules] =
    useState<AvailabilityRule[]>([])

  const [sessions, setSessions] =
    useState<BookableSession[]>([])

  const [bookings, setBookings] =
    useState<Booking[]>([])

  const [selectedSubject, setSelectedSubject] =
    useState<string | null>(null)

  const [selectedTutor, setSelectedTutor] =
    useState<string | null>(null)

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null)

  const [selectedSession, setSelectedSession] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [booking, setBooking] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    const today =
      formatLocalDate(new Date())

    const [
      subjectsResult,
      tutorsResult,
      availabilityResult,
      sessionsResult,
      bookingsResult,
    ] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, name')
        .order('name'),

      supabase
        .from('profiles')
        .select(
          'id, name, email, grade, subjects, role'
        )
        .eq('role', 'tutor')
        .order('name'),

      supabase
        .from('availability_rules')
        .select(
          'id, tutor_id'
        )
        .eq('active', true),

      supabase
        .from('bookable_sessions')
        .select(`
          id,
          availability_rule_id,
          schedule_window_id,
          session_type,
          session_date,
          start_time,
          end_time,
          slot_index
        `)
        .gte(
          'session_date',
          today
        )
        .order(
          'session_date'
        )
        .order(
          'start_time'
        ),

      supabase
        .from('bookings')
        .select(
          'id, session_id, student_id, tutor_id'
        ),
    ])

    console.log('TUTORS RESULT:', tutorsResult)
    console.log('AVAILABILITY RESULT:', availabilityResult)
    console.log('SESSIONS RESULT:', sessionsResult)
    console.log('BOOKINGS RESULT:', bookingsResult)

    const errors = [
      subjectsResult.error,
      tutorsResult.error,
      availabilityResult.error,
      sessionsResult.error,
      bookingsResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error(errors)

      setError(
        errors[0]?.message ||
          'Unable to load booking information.'
      )
    }

    setSubjects(
      subjectsResult.data || []
    )

    setTutors(
      tutorsResult.data || []
    )

    setAvailabilityRules(
      availabilityResult.data || []
    )

    setSessions(
      sessionsResult.data || []
    )

    setBookings(
      bookingsResult.data || []
    )

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  /*
   * Session IDs that are already occupied.
   */

  const bookedSessionIds =
    useMemo(() => {
      return new Set(
        bookings.map(
          (booking) =>
            booking.session_id
        )
      )
    }, [bookings])

  /*
   * Tutors who teach the selected subject.
   */

  const tutorsForSubject =
    useMemo(() => {
      if (!selectedSubject) {
        return []
      }

      return tutors.filter(
        (tutor) => {
          return (
            Array.isArray(
              tutor.subjects
            ) &&
            tutor.subjects.includes(
              selectedSubject
            )
          )
        }
      )
    }, [
      selectedSubject,
      tutors,
    ])

  /*
   * Availability rules belonging to
   * the selected tutor.
   */

  const selectedTutorRules =
    useMemo(() => {
      if (!selectedTutor) {
        return []
      }

      return availabilityRules.filter(
        (rule) =>
          rule.tutor_id ===
          selectedTutor
      )
    }, [
      selectedTutor,
      availabilityRules,
    ])

  /*
   * All available sessions for the
   * selected tutor.
   */

  const availableSessions =
    useMemo(() => {
      if (!selectedTutor) {
        return []
      }

      const ruleIds =
        selectedTutorRules.map(
          (rule) => rule.id
        )

      return sessions.filter(
        (session) => {
          return (
            ruleIds.includes(
              session.availability_rule_id
            ) &&
            !bookedSessionIds.has(
              session.id
            )
          )
        }
      )
    }, [
      selectedTutor,
      selectedTutorRules,
      sessions,
      bookedSessionIds,
    ])

  /*
   * Group available sessions by date.
   */

  const sessionsByDate =
    useMemo(() => {
      const grouped =
        new Map<
          string,
          BookableSession[]
        >()

      for (
        const session of
          availableSessions
      ) {
        const existing =
          grouped.get(
            session.session_date
          ) || []

        existing.push(session)

        grouped.set(
          session.session_date,
          existing
        )
      }

      return Array.from(
        grouped.entries()
      ).map(
        ([date, sessions]) => ({
          date,
          sessions,
        })
      )
    }, [
      availableSessions,
    ])

  /*
   * Select the first available date
   * when the tutor changes.
   */

  useEffect(() => {
    if (
      !selectedTutor ||
      sessionsByDate.length === 0
    ) {
      setSelectedDate(null)
      return
    }

    const stillExists =
      sessionsByDate.some(
        (group) =>
          group.date ===
          selectedDate
      )

    if (!stillExists) {
      setSelectedDate(
        sessionsByDate[0].date
      )
    }
  }, [
    selectedTutor,
    sessionsByDate,
    selectedDate,
  ])

  /*
   * Sessions for the selected date.
   */

  const sessionsForSelectedDate =
    useMemo(() => {
      if (!selectedDate) {
        return []
      }

      const group =
        sessionsByDate.find(
          (group) =>
            group.date ===
            selectedDate
        )

      return group?.sessions || []
    }, [
      selectedDate,
      sessionsByDate,
    ])

  const selectedTutorData =
    tutors.find(
      (tutor) =>
        tutor.id ===
        selectedTutor
    )

  const selectedSubjectData =
    subjects.find(
      (subject) =>
        subject.id ===
        selectedSubject
    )

  const selectedSessionData =
    sessions.find(
      (session) =>
        session.id ===
        selectedSession
    )

  function chooseSubject(
    subjectId: string
  ) {
    setSelectedSubject(
      subjectId
    )

    setSelectedTutor(null)
    setSelectedDate(null)
    setSelectedSession(null)

    setSuccess('')
    setError('')
  }

  function chooseTutor(
    tutorId: string
  ) {
    setSelectedTutor(
      tutorId
    )

    setSelectedDate(null)
    setSelectedSession(null)

    setSuccess('')
    setError('')
  }

  function chooseDate(
    date: string
  ) {
    setSelectedDate(
      date
    )

    setSelectedSession(null)
    setSuccess('')
  }

  function chooseSession(
    sessionId: string
  ) {
    setSelectedSession(
      sessionId
    )

    setSuccess('')
    setError('')
  }

  async function bookSession() {
    setError('')
    setSuccess('')

    if (
      !selectedSessionData ||
      !selectedTutorData
    ) {
      setError(
        'Please select a session.'
      )

      return
    }

    setBooking(true)

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      setError(
        'You must be signed in to book a tutoring session.'
      )

      setBooking(false)
      return
    }

    /*
     * Check whether the session was booked
     * between loading the page and clicking
     * the button.
     */

    const {
      data: existingBooking,
      error: checkError,
    } = await supabase
      .from('bookings')
      .select('id')
      .eq(
        'session_id',
        selectedSessionData.id
      )
      .maybeSingle()

    if (checkError) {
      setError(
        checkError.message
      )

      setBooking(false)
      return
    }

    if (existingBooking) {
      setError(
        'Sorry, another student just booked this session. Please choose another time.'
      )

      setSelectedSession(null)

      setBooking(false)

      await loadData()

      return
    }

    /*
     * Create the booking.
     */

    const {
      error: bookingError,
    } = await supabase
      .from('bookings')
      .insert({
        session_id:
          selectedSessionData.id,

        student_id:
          user.id,

        tutor_id:
          selectedTutorData.id,
      })

    if (bookingError) {
      console.error(
        bookingError
      )

      if (
        bookingError.code ===
        '23505'
      ) {
        setError(
          'Sorry, this session was just booked by another student. Please choose another time.'
        )
      } else {
        setError(
          bookingError.message
        )
      }

      setBooking(false)

      await loadData()

      return
    }

    setSuccess(
      'Your tutoring session has been booked!'
    )

    setSelectedSession(
      null
    )

    setBooking(false)

    await loadData()
  }

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="mx-auto max-w-5xl">
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Loading available tutors...
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="student">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Book a Tutor
          </h1>

          <p className="mt-1 text-muted-foreground">
            Find a peer tutor and choose a
            time that works for you.
          </p>
        </div>

        {/* PROGRESS */}

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <ProgressStep
            number="1"
            title="Choose a subject"
            active={
              !selectedSubject
            }
            complete={
              Boolean(
                selectedSubject
              )
            }
          />

          <ProgressStep
            number="2"
            title="Choose a tutor"
            active={
              Boolean(
                selectedSubject
              ) &&
              !selectedTutor
            }
            complete={
              Boolean(
                selectedTutor
              )
            }
          />

          <ProgressStep
            number="3"
            title="Choose a time"
            active={
              Boolean(
                selectedTutor
              )
            }
            complete={
              Boolean(
                selectedSession
              )
            }
          />
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* STEP 1 */}

        <section className="rounded-2xl border bg-white shadow-sm">

          <div className="border-b p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                1
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  What do you need help with?
                </h2>

                <p className="text-sm text-muted-foreground">
                  Select the subject you want tutoring in.
                </p>
              </div>
            </div>
          </div>

          {subjects.length === 0 ? (
            <div className="p-6">
              <p className="text-muted-foreground">
                No subjects are available yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 p-6">
              {subjects.map(
                (subject) => (
                  <Button
                    key={
                      subject.id
                    }
                    variant={
                      selectedSubject ===
                      subject.id
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-full"
                    onClick={() =>
                      chooseSubject(
                        subject.id
                      )
                    }
                  >
                    {subject.name}
                  </Button>
                )
              )}
            </div>
          )}
        </section>

        {/* STEP 2 */}

        {selectedSubject && (
          <section className="mt-6 rounded-2xl border bg-white shadow-sm">

            <div className="border-b p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  2
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Choose a tutor
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Tutors available for{' '}
                    <span className="font-medium text-foreground">
                      {
                        selectedSubjectData?.name
                      }
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>

            {tutorsForSubject.length === 0 ? (
              <div className="p-6">
                <p className="font-medium">
                  No tutors are currently available for this subject.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Try another subject or check back later.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 p-6 md:grid-cols-2">
                {tutorsForSubject.map(
                  (tutor) => {
                    const tutorSubjects =
                      tutor.subjects
                        ?.map(
                          (
                            subjectId
                          ) =>
                            subjects.find(
                              (
                                subject
                              ) =>
                                subject.id ===
                                subjectId
                            )
                        )
                        .filter(
                          Boolean
                        ) as Subject[]

                    const isSelected =
                      selectedTutor ===
                      tutor.id

                    return (
                      <button
                        key={
                          tutor.id
                        }
                        type="button"
                        onClick={() =>
                          chooseTutor(
                            tutor.id
                          )
                        }
                        className={`rounded-xl border p-5 text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">
                              {tutor.name}
                            </p>

                            {tutor.grade && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Grade{' '}
                                {tutor.grade}
                              </p>
                            )}
                          </div>

                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isSelected
                              ? '✓'
                              : '→'}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {tutorSubjects.map(
                            (
                              subject
                            ) => (
                              <Badge
                                key={
                                  subject.id
                                }
                                variant="secondary"
                              >
                                {
                                  subject.name
                                }
                              </Badge>
                            )
                          )}
                        </div>
                      </button>
                    )
                  }
                )}
              </div>
            )}
          </section>
        )}

        {/* STEP 3 */}

        {selectedTutor && (
          <section className="mt-6 rounded-2xl border bg-white shadow-sm">

            <div className="border-b p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  3
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Choose a time
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Available sessions with{' '}
                    <span className="font-medium text-foreground">
                      {
                        selectedTutorData?.name
                      }
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>

            {sessionsByDate.length === 0 ? (
              <div className="p-6">
                <p className="font-medium">
                  No upcoming sessions are available.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  This tutor may add more availability later. Try another tutor if you need help sooner.
                </p>
              </div>
            ) : (
              <div className="p-6">

                {/* DATE SELECTOR */}

                <div className="mb-6">
                  <p className="mb-3 text-sm font-medium">
                    Select a day
                  </p>

                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {sessionsByDate.map(
                      (group) => {
                        const isSelected =
                          selectedDate ===
                          group.date

                        return (
                          <button
                            key={
                              group.date
                            }
                            type="button"
                            onClick={() =>
                              chooseDate(
                                group.date
                              )
                            }
                            className={`min-w-[100px] rounded-xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'hover:border-primary/40 hover:bg-muted/40'
                            }`}
                          >
                            <p className="text-xs font-medium opacity-80">
                              {formatWeekday(
                                group.date
                              )}
                            </p>

                            <p className="mt-1 font-semibold">
                              {formatShortDate(
                                group.date
                              )}
                            </p>

                            <p className="mt-1 text-xs opacity-70">
                              {
                                group
                                  .sessions
                                  .length
                              }{' '}
                              {group
                                .sessions
                                .length ===
                              1
                                ? 'time'
                                : 'times'}
                            </p>
                          </button>
                        )
                      }
                    )}
                  </div>
                </div>

                {/* TIMES */}

                {selectedDate && (
                  <div>
                    <p className="mb-3 text-sm font-medium">
                      Available times
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {sessionsForSelectedDate.map(
                        (
                          session
                        ) => {
                          const isSelected =
                            selectedSession ===
                            session.id

                          return (
                            <button
                              key={
                                session.id
                              }
                              type="button"
                              onClick={() =>
                                chooseSession(
                                  session.id
                                )
                              }
                              className={`rounded-xl border p-4 text-left transition ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'hover:border-primary/40 hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-lg font-semibold">
                                    {formatTime(
                                      session.start_time
                                    )}
                                    {' – '}
                                    {formatTime(
                                      session.end_time
                                    )}
                                  </p>

                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {
                                      sessionTypeDescriptions[
                                        session.session_type
                                      ]
                                    }
                                  </p>
                                </div>

                                <Badge
                                  variant={
                                    isSelected
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {
                                    sessionTypeLabels[
                                      session.session_type
                                    ]
                                  }
                                </Badge>
                              </div>
                            </button>
                          )
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* CONFIRMATION */}

        {selectedSessionData && (
          <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Confirm your session
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Make sure everything looks right before booking.
            </p>

            <div className="mt-5 rounded-xl bg-muted/40 p-5">

              <div className="flex flex-wrap items-center gap-2">
                <Badge>
                  {
                    selectedSessionData
                      .session_type ===
                    'official'
                      ? 'Official Session'
                      : sessionTypeLabels[
                          selectedSessionData
                            .session_type
                        ]
                  }
                </Badge>

                <Badge variant="secondary">
                  {
                    selectedSubjectData?.name
                  }
                </Badge>
              </div>

              <div className="mt-4">
                <p className="text-xl font-semibold">
                  {formatDate(
                    selectedSessionData.session_date
                  )}
                </p>

                <p className="mt-1 text-lg">
                  {formatTime(
                    selectedSessionData.start_time
                  )}
                  {' – '}
                  {formatTime(
                    selectedSessionData.end_time
                  )}
                </p>
              </div>

              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Tutor
                </p>

                <p className="font-medium">
                  {
                    selectedTutorData?.name
                  }
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                className="sm:min-w-48"
                onClick={
                  bookSession
                }
                disabled={booking}
              >
                {booking
                  ? 'Booking...'
                  : 'Confirm Booking'}
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setSelectedSession(
                    null
                  )
                }
                disabled={booking}
              >
                Choose a Different Time
              </Button>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}

function ProgressStep({
  number,
  title,
  active,
  complete,
}: {
  number: string
  title: string
  active: boolean
  complete: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active || complete
          ? 'bg-white'
          : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
            complete
              ? 'bg-primary text-primary-foreground'
              : active
                ? 'border-2 border-primary'
                : 'bg-muted'
          }`}
        >
          {complete
            ? '✓'
            : number}
        </div>

        <p className="font-medium">
          {title}
        </p>
      </div>
    </div>
  )
}

/*
 * Format 3:15 PM from a database time.
 */

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

/*
 * Format:
 * Thursday, September 3
 */

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

/*
 * Format:
 * Thu
 */

function formatWeekday(
  date: string
) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    [],
    {
      weekday: 'short',
    }
  )
}

/*
 * Format:
 * Sep 3
 */

function formatShortDate(
  date: string
) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    [],
    {
      month: 'short',
      day: 'numeric',
    }
  )
}

/*
 * Local YYYY-MM-DD.
 *
 * Do NOT use toISOString() here.
 */

function formatLocalDate(
  date: Date
) {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0')

  const day =
    String(
      date.getDate()
    ).padStart(2, '0')

  return (
    `${year}-${month}-${day}`
  )
}
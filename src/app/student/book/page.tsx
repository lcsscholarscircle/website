'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SubjectType =
  | 'math'
  | 'english'
  | 'science'
  | 'history'
  | 'spanish'

type Subject = {
  id: string
  name: string
  type: SubjectType
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
  session_type: 'lfp' | 'virtual' | 'library'
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
  lfp: 'LFP',
  virtual: 'Virtual',
  library: 'Library',
}

const sessionTypeDescriptions = {
  lfp: 'On campus, during school hours.',
  virtual: 'Online, via Google Meet.',
  library: 'At the library after school.',
}

const subjectGroups: {
  type: SubjectType
  label: string
  containerClass: string
  headerClass: string
  buttonSelectedClass: string
  buttonClass: string
}[] = [
  {
    type: 'math',
    label: 'Math',
    containerClass: 'border-red-200 bg-red-50/70',
    headerClass: 'text-red-800',
    buttonSelectedClass:
      'border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white',
    buttonClass:
      'border-red-200 bg-white text-red-900 hover:border-red-400 hover:bg-red-100',
  },
  {
    type: 'english',
    label: 'English',
    containerClass: 'border-blue-200 bg-blue-50/70',
    headerClass: 'text-blue-800',
    buttonSelectedClass:
      'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white',
    buttonClass:
      'border-blue-200 bg-white text-blue-900 hover:border-blue-400 hover:bg-blue-100',
  },
  {
    type: 'science',
    label: 'Science',
    containerClass: 'border-green-200 bg-green-50/70',
    headerClass: 'text-green-800',
    buttonSelectedClass:
      'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white',
    buttonClass:
      'border-green-200 bg-white text-green-900 hover:border-green-400 hover:bg-green-100',
  },
  {
    type: 'history',
    label: 'History',
    containerClass: 'border-yellow-200 bg-yellow-50/70',
    headerClass: 'text-yellow-800',
    buttonSelectedClass:
      'border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-600 hover:text-white',
    buttonClass:
      'border-yellow-200 bg-white text-yellow-900 hover:border-yellow-400 hover:bg-yellow-100',
  },
  {
    type: 'spanish',
    label: 'Spanish',
    containerClass: 'border-purple-200 bg-purple-50/70',
    headerClass: 'text-purple-800',
    buttonSelectedClass:
      'border-purple-600 bg-purple-600 text-white hover:bg-purple-700 hover:text-white',
    buttonClass:
      'border-purple-200 bg-white text-purple-900 hover:border-purple-400 hover:bg-purple-100',
  },
]

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

  const [studentGrade, setStudentGrade] =
    useState<number | null>(null)

  const [showLfpSessions, setShowLfpSessions] =
    useState(true)

  const [studentLoaded, setStudentLoaded] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [now, setNow] =
    useState(() => new Date())

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(
        'You must be signed in to book a tutoring session.'
      )

      setLoading(false)
      return
    }

    const [
      studentProfileResult,
      subjectsResult,
      tutorsResult,
      availabilityResult,
      sessionsResult,
      bookingsResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('grade')
        .eq('id', user.id)
        .single(),

      supabase
        .from('subjects')
        .select('id, name, type')
        .order('name'),

      supabase
        .from('profiles')
        .select(
          'id, name, email, grade, subjects, role'
        )
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

    if (studentProfileResult.error) {
      console.error(
        studentProfileResult.error
      )

      setError(
        studentProfileResult.error.message
      )

      setLoading(false)
      return
    }

    const grade =
      studentProfileResult.data?.grade ?? null

    setStudentGrade(grade)

    setShowLfpSessions(false)

    setStudentLoaded(true)

    console.log(
      'STUDENT PROFILE:',
      studentProfileResult
    )
    console.log(
      'TUTORS RESULT:',
      tutorsResult
    )
    console.log(
      'AVAILABILITY RESULT:',
      availabilityResult
    )
    console.log(
      'SESSIONS RESULT:',
      sessionsResult
    )
    console.log(
      'BOOKINGS RESULT:',
      bookingsResult
    )

    const errors = [
      studentProfileResult.error,
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
   * Keep the current time fresh so sessions disappear from the
   * booking page as soon as they enter the 24-hour window.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 60 * 1000)

    return () => window.clearInterval(interval)
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

  const filteredSessions =
    useMemo(() => {
      /*
      * LFP sessions take place at LFP.
      *
      * Grade 9+ students can always see LFP
      * sessions.
      *
      * Students below grade 9 can see LFP
      * sessions only when the toggle is ON.
      *
      * Students with no grade are treated as
      * grade 9+ and can always see LFP sessions.
      */

      const canSeeLfp =
        studentGrade === null ||
        (
          studentGrade >= 9 ||
          showLfpSessions
        )

      return sessions.filter(
        (session) => {
          const isLfpSession =
            session.session_type === 'lfp'

          if (
            isLfpSession &&
            !canSeeLfp
          ) {
            return false
          }

          return isSessionAtLeast24HoursAway(
            session,
            now
          )
        }
      )
    }, [
      sessions,
      studentGrade,
      showLfpSessions,
      now,
    ])

  /*
   * Tutor IDs that currently have at least one
   * upcoming, unbooked session.
   */

  const tutorsWithAvailableSessions =
    useMemo(() => {
      const availableTutorIds =
        new Set<string>()

      for (const session of filteredSessions) {
        if (
          bookedSessionIds.has(session.id)
        ) {
          continue
        }

        const rule =
          availabilityRules.find(
            (rule) =>
              rule.id ===
              session.availability_rule_id
          )

        if (rule) {
          availableTutorIds.add(
            rule.tutor_id
          )
        }
      }

      return availableTutorIds
    }, [
      filteredSessions,
      availabilityRules,
      bookedSessionIds,
    ])

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
            ) &&
            tutorsWithAvailableSessions.has(
              tutor.id
            )
          )
        }
      )
    }, [
      selectedSubject,
      tutors,
      tutorsWithAvailableSessions,
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

      return filteredSessions.filter(
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
      filteredSessions,
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

    /*
     * Re-check the 24-hour cutoff immediately before booking.
     * This prevents a session from being booked if it crossed
     * into the 24-hour window while the page was open.
     */
    if (
      !isSessionAtLeast24HoursAway(
        selectedSessionData
      )
    ) {
      setError(
        'Sessions must be booked at least 24 hours in advance. Please choose another time.'
      )
      setSelectedSession(null)
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

    // consts for notifs
    const sessionDateTime = new Date(
      `${selectedSessionData.session_date}T${selectedSessionData.start_time}`
    )

    const scheduledFor = new Date(
      sessionDateTime.getTime() - 60 * 60 * 1000
    ).toISOString()

    // Create notification for the tutor
    const { error: tutorNotificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: selectedTutorData.id,
        notification_type: 'session_booked',
        session_id: selectedSessionData.id,
        scheduled_for: new Date().toISOString(),
      })

    if (tutorNotificationError) {
      console.error(
        'Booking succeeded, but tutor notification could not be created:',
        tutorNotificationError
      )
    }

    // Create reminder for the tutor
    const { error: tReminderNotificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: selectedTutorData.id,
        notification_type: 'session_reminder',
        session_id: selectedSessionData.id,
        scheduled_for: scheduledFor,
      })

    if (tReminderNotificationError) {
      console.error(
        'Booking succeeded, but tutor reminder notification could not be created:',
        tReminderNotificationError
      )
    }

    // Create notification for the student
    const { error: studentNotificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: user.id,
        notification_type: 'session_confirmation',
        session_id: selectedSessionData.id,
        scheduled_for: new Date().toISOString(),
      })

    if (studentNotificationError) {
      console.error(
        'Booking succeeded, but student notification could not be created:',
        studentNotificationError
      )
    }

    // Create reminder notification

    const { error: reminderNotificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: user.id,
        notification_type: 'session_reminder',
        session_id: selectedSessionData.id,
        scheduled_for: scheduledFor,
      })

    if (reminderNotificationError) {
      console.error(
        'Booking succeeded, but reminder notification could not be created:',
        reminderNotificationError
      )
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
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                1
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-semibold">
                      What do you need help with?
                    </h2>

                    <p className="text-sm text-muted-foreground">
                      Select the subject you want tutoring in.
                    </p>
                  </div>

                  {studentLoaded &&
                    studentGrade !== null &&
                    studentGrade < 9 && (
                      <div className="shrink-0">
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              Show LFP sessions
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              LFP sessions take place at the LFP campus during school hours.
                            </p>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={showLfpSessions}
                            onClick={() => {
                              setShowLfpSessions((current) => !current)

                              setSelectedTutor(null)
                              setSelectedDate(null)
                              setSelectedSession(null)
                              setSuccess('')
                              setError('')
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                              showLfpSessions
                                ? 'bg-primary'
                                : 'bg-muted-foreground/30'
                            }`}
                          >
                            <span
                              className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                                showLfpSessions
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                </div>
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
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
              {subjectGroups.map(
                (group) => {
                  const groupSubjects =
                    subjects.filter(
                      (subject) =>
                        subject.type ===
                        group.type
                    )

                  return (
                    <div
                      key={group.type}
                      className={`rounded-2xl border p-4 ${group.containerClass}`}
                    >
                      <h3
                        className={`mb-3 text-sm font-bold uppercase tracking-wide ${group.headerClass}`}
                      >
                        {group.label}
                      </h3>

                      {groupSubjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No subjects
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {groupSubjects.map(
                            (subject) => {
                              const isSelected =
                                selectedSubject ===
                                subject.id

                              return (
                                <Button
                                  key={
                                    subject.id
                                  }
                                  variant="outline"
                                  className={`w-full h-auto min-h-10 justify-start whitespace-normal break-words rounded-xl border text-left shadow-none ${
                                    isSelected
                                      ? group.buttonSelectedClass
                                      : group.buttonClass
                                  }`}
                                  onClick={() =>
                                    chooseSubject(
                                      subject.id
                                    )
                                  }
                                >
                                  {subject.name}
                                </Button>
                              )
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )
                }
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
                    'library'
                      ? 'Library Session'
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
 * A session can only be booked if its start time is at least
 * 24 hours in the future.
 *
 * Session dates/times are interpreted in the browser's local
 * timezone, matching the existing booking-page date/time logic.
 */
function isSessionAtLeast24HoursAway(
  session: Pick<BookableSession, 'session_date' | 'start_time'>,
  referenceDate: Date = new Date()
) {
  const sessionStart = new Date(
    `${session.session_date}T${session.start_time}`
  )

  return (
    sessionStart.getTime() - referenceDate.getTime() >=
    24 * 60 * 60 * 1000
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
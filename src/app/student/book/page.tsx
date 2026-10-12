
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  | 'college'

type SessionType = 'lfp' | 'virtual' | 'library'

type Subject = {
  id: string
  name: string
  type: SubjectType
  sort: number | null
}

type Tutor = {
  id: string
  name: string
  email: string
  grade: number | null
  subjects: string[] | null
  role: string
}

type AvailabilityRule = {
  id: string
  tutor_id: string
}

type BookableSession = {
  id: string
  availability_rule_id: string
  schedule_window_id: string | null
  session_type: SessionType
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
  status: string
}

const SESSION_TYPES: SessionType[] = [
  'lfp',
  'library',
  'virtual',
]

const SESSION_LABELS: Record<SessionType, string> = {
  lfp: 'LFP',
  library: 'Library',
  virtual: 'Virtual',
}

const SESSION_DESCRIPTIONS: Record<SessionType, string> = {
  lfp: 'On campus, during school hours.',
  library: 'At the Filipe de Neve library, across from LFP.',
  virtual: 'Online, via Google Meet.',
}

const SUBJECT_GROUPS: {
  type: SubjectType
  label: string
  color: string
}[] = [
  { type: 'math', label: 'Math', color: 'border-red-200 bg-red-50 text-red-800' },
  { type: 'english', label: 'English', color: 'border-blue-200 bg-blue-50 text-blue-800' },
  { type: 'science', label: 'Science', color: 'border-green-200 bg-green-50 text-green-800' },
  { type: 'history', label: 'History', color: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  { type: 'spanish', label: 'Spanish', color: 'border-purple-200 bg-purple-50 text-purple-800' },
  { type: 'college', label: 'College Prep', color: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
]

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

type TimeFilter = 'any' | 'morning' | 'afternoon' | 'evening'

export default function BookPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([])
  const [sessions, setSessions] = useState<BookableSession[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  const [studentGrade, setStudentGrade] = useState<number | null>(null)
  const [studentLoaded, setStudentLoaded] = useState(false)
  const [showLfpSessions, setShowLfpSessions] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedTutor, setSelectedTutor] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([
    'lfp',
    'library',
    'virtual',
  ])
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any')
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [booking, setBooking] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    const today = formatLocalDate(new Date())

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('You must be signed in to book a tutoring session.')
        return
      }

      const [
        profileResult,
        subjectsResult,
        tutorsResult,
        rulesResult,
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
          .select('id, name, type, sort')
          .order('sort', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true }),

        supabase
          .from('profiles')
          .select('id, name, email, grade, subjects, role')
          .in('role', ['tutor', 'leader'])
          .order('name'),

        supabase
          .from('availability_rules')
          .select('id, tutor_id')
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
          .gte('session_date', today)
          .order('session_date')
          .order('start_time'),

        supabase
          .from('bookings')
          .select('id, session_id, student_id, tutor_id, status'),
      ])

      const errors = [
        profileResult.error,
        subjectsResult.error,
        tutorsResult.error,
        rulesResult.error,
        sessionsResult.error,
        bookingsResult.error,
      ].filter(Boolean)

      if (errors.length > 0) {
        console.error('Booking page load errors:', errors)
        setError(errors[0]?.message || 'Unable to load booking information.')
        return
      }

      setStudentGrade(profileResult.data?.grade ?? null)
      setStudentLoaded(true)

      // Students below grade 9 do not see LFP sessions by default.
      // A NULL grade is treated as grade 9 or above.
      setShowLfpSessions(false)

      setSubjects((subjectsResult.data || []) as Subject[])

      setTutors(
        ((tutorsResult.data || []) as Tutor[]).filter(
          (tutor) => Array.isArray(tutor.subjects)
        )
      )

      setAvailabilityRules((rulesResult.data || []) as AvailabilityRule[])
      setSessions((sessionsResult.data || []) as BookableSession[])
      setBookings((bookingsResult.data || []) as Booking[])
    } catch (err) {
      console.error('Unable to load booking page:', err)
      setError('An unexpected error occurred while loading booking information.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Refresh the 24-hour cutoff as time passes.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const bookedSessionIds = useMemo(() => {
    return new Set(
      bookings
        .filter((booking) => !isCancelledBooking(booking.status))
        .map((booking) => booking.session_id)
    )
  }, [bookings])

  const rulesById = useMemo(() => {
    return new Map(availabilityRules.map((rule) => [rule.id, rule]))
  }, [availabilityRules])

  const tutorsById = useMemo(() => {
    return new Map(tutors.map((tutor) => [tutor.id, tutor]))
  }, [tutors])

  const subjectsById = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]))
  }, [subjects])

  const canSeeLfp =
    studentGrade === null ||
    studentGrade >= 9 ||
    showLfpSessions

  /*
   * Apply all session filters in one place.
   * Subjects and tutors are then matched against this list,
   * so a tutor is never shown solely because they have a
   * session that fails the student's selected filters.
   */
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (bookedSessionIds.has(session.id)) return false

      if (!isSessionAtLeast24HoursAway(session, now)) return false

      if (session.session_type === 'lfp' && !canSeeLfp) return false

      if (!sessionTypes.includes(session.session_type)) return false

      if (dateFrom && session.session_date < dateFrom) return false
      if (dateTo && session.session_date > dateTo) return false

      if (selectedDays.length > 0) {
        const weekday = new Date(
          `${session.session_date}T00:00:00`
        ).getDay()

        if (!selectedDays.includes(weekday)) return false
      }

      if (timeFilter !== 'any') {
        const start = timeToMinutes(session.start_time)
        const end = timeToMinutes(session.end_time)

        if (timeFilter === 'morning' && start >= 12 * 60) return false

        if (
          timeFilter === 'afternoon' &&
          (end <= 12 * 60 || start >= 17 * 60)
        ) {
          return false
        }

        if (timeFilter === 'evening' && end <= 17 * 60) return false
      }

      return true
    })
  }, [
    sessions,
    bookedSessionIds,
    now,
    canSeeLfp,
    sessionTypes,
    dateFrom,
    dateTo,
    selectedDays,
    timeFilter,
  ])

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    return subjects.filter((subject) => {
      if (!query) return true

      return (
        subject.name.toLowerCase().includes(query) ||
        (SUBJECT_GROUPS.find((group) => group.type === subject.type)?.label
          .toLowerCase()
          .includes(query) ?? false)
      )
    })
  }, [subjects, search])

  const tutorsForSubject = useMemo(() => {
    if (!selectedSubject) return []

    const matchingTutorSessions = new Map<string, BookableSession[]>()

    for (const session of filteredSessions) {
      const rule = rulesById.get(session.availability_rule_id)
      if (!rule) continue

      const tutor = tutorsById.get(rule.tutor_id)
      if (!tutor || !tutor.subjects?.includes(selectedSubject)) continue

      const existing = matchingTutorSessions.get(tutor.id) || []
      existing.push(session)
      matchingTutorSessions.set(tutor.id, existing)
    }

    return Array.from(matchingTutorSessions.entries())
      .map(([tutorId, tutorSessions]) => ({
        tutor: tutorsById.get(tutorId)!,
        sessions: tutorSessions.sort(compareSessions),
      }))
      .sort((a, b) => {
        const dateComparison = compareSessions(a.sessions[0], b.sessions[0])
        return dateComparison || a.tutor.name.localeCompare(b.tutor.name)
      })
  }, [
    selectedSubject,
    filteredSessions,
    rulesById,
    tutorsById,
  ])

  const selectedSubjectData = selectedSubject
    ? subjectsById.get(selectedSubject)
    : undefined

  const selectedTutorData = selectedTutor
    ? tutorsById.get(selectedTutor)
    : undefined

  const selectedSessionData = selectedSession
    ? sessions.find((session) => session.id === selectedSession)
    : undefined

  const selectedTutorSessions = useMemo(() => {
    if (!selectedTutor) return []

    return filteredSessions
      .filter((session) => {
        const rule = rulesById.get(session.availability_rule_id)
        return rule?.tutor_id === selectedTutor
      })
      .sort(compareSessions)
  }, [selectedTutor, filteredSessions, rulesById])

  const activeFilterCount =
    (sessionTypes.length !== SESSION_TYPES.length ? 1 : 0) +
    (selectedDays.length > 0 ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (timeFilter !== 'any' ? 1 : 0)

  function resetTutorSelection() {
    setSelectedTutor(null)
    setSelectedSession(null)
    setSuccess('')
    setError('')
  }

  function chooseSubject(subjectId: string) {
    setSelectedSubject((current) =>
      current === subjectId ? null : subjectId
    )
    resetTutorSelection()
  }

  function chooseTutor(tutorId: string) {
    setSelectedTutor((current) =>
      current === tutorId ? null : tutorId
    )
    setSelectedSession(null)
    setSuccess('')
    setError('')
  }

  function toggleSessionType(type: SessionType) {
    setSessionTypes((current) => {
      const next = current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]

      return next
    })

    resetTutorSelection()
  }

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    )

    resetTutorSelection()
  }

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value)
    resetTutorSelection()
  }

  function clearFilters() {
    setSessionTypes([...SESSION_TYPES])
    setSelectedDays([])
    setDateFrom('')
    setDateTo('')
    setTimeFilter('any')
    setSearch('')
    setShowLfpSessions(false)
    resetTutorSelection()
  }

  async function bookSession() {
    setError('')
    setSuccess('')

    if (!selectedSessionData || !selectedTutorData || !selectedSubjectData) {
      setError('Please select a subject, tutor, and session.')
      return
    }

    if (
      !isSessionAtLeast24HoursAway(selectedSessionData, new Date())
    ) {
      setError(
        'Sessions must be booked at least 24 hours in advance. Please choose another time.'
      )
      setSelectedSession(null)
      return
    }

    if (
      selectedSessionData.session_type === 'lfp' &&
      studentGrade !== null &&
      studentGrade < 9 &&
      !showLfpSessions
    ) {
      setError('Enable LFP sessions before booking this session.')
      setSelectedSession(null)
      return
    }

    setBooking(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('You must be signed in to book a tutoring session.')
        return
      }

      // Recheck the session to prevent two students booking it simultaneously.
      const { data: existingBooking, error: checkError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('session_id', selectedSessionData.id)

      if (checkError) {
        setError(checkError.message)
        return
      }

      if (
        (existingBooking || []).some(
          (item) => !isCancelledBooking(item.status)
        )
      ) {
        setError(
          'Sorry, another student just booked this session. Please choose another time.'
        )
        setSelectedSession(null)
        await loadData(true)
        return
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          session_id: selectedSessionData.id,
          student_id: user.id,
          tutor_id: selectedTutorData.id,
          subject: selectedSubjectData.name,
        })

      if (bookingError) {
        console.error('Booking failed:', bookingError)

        if (bookingError.code === '23505') {
          setError(
            'Sorry, this session was just booked by another student. Please choose another time.'
          )
        } else {
          setError(bookingError.message)
        }

        await loadData(true)
        return
      }

      const sessionDateTime = new Date(
        `${selectedSessionData.session_date}T${selectedSessionData.start_time}`
      )

      const scheduledFor = new Date(
        sessionDateTime.getTime() - 60 * 60 * 1000
      ).toISOString()

      const immediate = new Date().toISOString()

      const notificationResults = await Promise.all([
        supabase.from('notifications').insert({
          recipient_id: selectedTutorData.id,
          notification_type: 'session_booked',
          session_id: selectedSessionData.id,
          scheduled_for: immediate,
        }),
        supabase.from('notifications').insert({
          recipient_id: selectedTutorData.id,
          notification_type: 'session_reminder',
          session_id: selectedSessionData.id,
          scheduled_for: scheduledFor,
        }),
        supabase.from('notifications').insert({
          recipient_id: user.id,
          notification_type: 'session_confirmation',
          session_id: selectedSessionData.id,
          scheduled_for: immediate,
        }),
        supabase.from('notifications').insert({
          recipient_id: user.id,
          notification_type: 'session_reminder',
          session_id: selectedSessionData.id,
          scheduled_for: scheduledFor,
        }),
      ])

      for (const result of notificationResults) {
        if (result.error) {
          console.error(
            'Booking succeeded, but a notification could not be created:',
            result.error
          )
        }
      }

      setSuccess('Your tutoring session has been booked!')
      setSelectedSession(null)
      setSelectedTutor(null)

      await loadData(true)
    } catch (err) {
      console.error('Booking error:', err)
      setError('An unexpected error occurred while booking. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="mx-auto max-w-6xl py-12 text-center">
          <p className="text-muted-foreground">
            Loading available tutoring sessions...
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="student">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Book a Tutor
            </h1>
            <p className="mt-1 text-muted-foreground">
              Find a subject, choose a time that works, and book a peer tutor.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh availability'}
          </Button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        {/* Search and subjects */}
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                1
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">
                  What would you like help with?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Search for a subject or browse a category. Subjects are ordered
                  by their configured sort number.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="subject-search" className="sr-only">
                Search subjects
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                  <SearchIcon />
                </span>
                <input
                  id="subject-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search math, chemistry, SAT prep..."
                  className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {studentLoaded && studentGrade !== null && studentGrade < 9 && (
              <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">Show LFP sessions</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    LFP sessions take place at school during school hours.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={showLfpSessions}
                  onClick={() => {
                    setShowLfpSessions((current) => !current)
                    resetTutorSelection()
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    showLfpSessions
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      showLfpSessions ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {subjects.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No subjects are available yet.
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="p-6">
              <p className="font-medium">No subjects match your search.</p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-2 text-sm text-primary underline underline-offset-4"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-5 p-5 sm:p-6">
              {SUBJECT_GROUPS.map((group) => {
                const groupSubjects = filteredSubjects.filter(
                  (subject) => subject.type === group.type
                )

                if (groupSubjects.length === 0) return null

                return (
                  <div key={group.type}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        {group.label}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {groupSubjects.length}{' '}
                        {groupSubjects.length === 1 ? 'subject' : 'subjects'}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {groupSubjects.map((subject) => {
                        const isSelected = selectedSubject === subject.id

                        return (
                          <button
                            key={subject.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => chooseSubject(subject.id)}
                            className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'hover:border-primary/40 hover:bg-muted/30'
                            }`}
                          >
                            <span className="font-medium">{subject.name}</span>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isSelected ? '✓' : '→'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Find a time that works</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only tutors with sessions matching these filters will appear.
              </p>
            </div>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Session location</p>
              <div className="flex flex-wrap gap-2">
                {SESSION_TYPES.map((type) => {
                  const active = sessionTypes.includes(type)
                  const hiddenLfp =
                    type === 'lfp' && !canSeeLfp

                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleSessionType(type)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      {SESSION_LABELS[type]}
                      {hiddenLfp ? ' (hidden for your grade)' : ''}
                    </button>
                  )
                })}
              </div>

              {!canSeeLfp && sessionTypes.includes('lfp') && (
                <p className="mt-2 text-xs text-muted-foreground">
                  LFP is selected, but its sessions remain hidden until you
                  enable the LFP toggle above.
                </p>
              )}

              {sessionTypes.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Select at least one session location to see results.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Days of the week</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = selectedDays.includes(day.value)

                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day.value)}
                      className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Leave all days unselected to include every day.
              </p>
            </div>

            <div>
              <button
                type="button"
                aria-expanded={showMoreFilters}
                onClick={() => setShowMoreFilters((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition hover:bg-muted/30"
              >
                <span className="font-medium">More filters</span>
                <span className="text-sm text-muted-foreground">
                  {showMoreFilters ? '− Hide' : '+ Date and time'}
                </span>
              </button>

              {showMoreFilters && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="date-from"
                      className="mb-2 block text-sm font-medium"
                    >
                      From date
                    </label>
                    <input
                      id="date-from"
                      type="date"
                      min={formatLocalDate(now)}
                      max={dateTo || undefined}
                      value={dateFrom}
                      onChange={(event) =>
                        updateFilter(setDateFrom, event.target.value)
                      }
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="date-to"
                      className="mb-2 block text-sm font-medium"
                    >
                      Through date
                    </label>
                    <input
                      id="date-to"
                      type="date"
                      min={dateFrom || formatLocalDate(now)}
                      value={dateTo}
                      onChange={(event) =>
                        updateFilter(setDateTo, event.target.value)
                      }
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="time-of-day"
                      className="mb-2 block text-sm font-medium"
                    >
                      Time of day
                    </label>
                    <select
                      id="time-of-day"
                      value={timeFilter}
                      onChange={(event) =>
                        updateFilter(
                          setTimeFilter,
                          event.target.value as TimeFilter
                        )
                      }
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="any">Any time</option>
                      <option value="morning">Morning (before noon)</option>
                      <option value="afternoon">Afternoon (12–5 PM)</option>
                      <option value="evening">Evening (5 PM onward)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {filteredSessions.length}
              </span>
              matching available{' '}
              {filteredSessions.length === 1 ? 'session' : 'sessions'}
              <span>·</span>
              Book at least 24 hours in advance
            </div>
          </div>
        </section>

        {/* Tutor results */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  2
                </div>
                <h2 className="text-xl font-semibold">Available tutors</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedSubjectData
                  ? `Tutors for ${selectedSubjectData.name} who match your filters.`
                  : 'Choose a subject above to find matching tutors.'}
              </p>
            </div>

            {selectedSubject && (
              <Badge variant="secondary">
                {tutorsForSubject.length}{' '}
                {tutorsForSubject.length === 1 ? 'tutor' : 'tutors'}
              </Badge>
            )}
          </div>

          {!selectedSubject ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="font-medium">Choose a subject to get started</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your tutor results will appear here.
              </p>
            </div>
          ) : tutorsForSubject.length === 0 ? (
            <div className="rounded-2xl border p-6">
              <p className="font-medium">
                No tutors match this subject and your current filters.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different location, day, or time range, or select another
                subject. You can also check back later.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubject(null)}
                >
                  Choose another subject
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tutorsForSubject.map(({ tutor, sessions: tutorSessions }) => {
                const expanded = selectedTutor === tutor.id
                const tutorSubjects = (tutor.subjects || [])
                  .map((id) => subjectsById.get(id))
                  .filter((subject): subject is Subject => Boolean(subject))

                const nextSession = tutorSessions[0]

                return (
                  <article
                    key={tutor.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                      expanded ? 'border-primary ring-1 ring-primary/30' : ''
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => chooseTutor(tutor.id)}
                      className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{tutor.name}</h3>
                          {tutor.grade !== null && tutor.grade !== undefined && (
                            <Badge variant="outline">Grade {tutor.grade}</Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {tutorSubjects.map((subject) => (
                            <Badge key={subject.id} variant="secondary">
                              {subject.name}
                            </Badge>
                          ))}
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground">
                          Next available:{' '}
                          <span className="font-medium text-foreground">
                            {formatWeekdayLong(nextSession.session_date)},{' '}
                            {formatShortDate(nextSession.session_date)} at{' '}
                            {formatTime(nextSession.start_time)}
                          </span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="font-semibold">
                            {tutorSessions.length}{' '}
                            {tutorSessions.length === 1 ? 'session' : 'sessions'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            match your filters
                          </p>
                        </div>
                        <span className="text-lg text-muted-foreground">
                          {expanded ? '−' : '+'}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t bg-muted/10 p-5">
                        <div className="mb-4">
                          <h4 className="font-semibold">Choose a session</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Select an available time below.
                          </p>
                        </div>

                        <div className="space-y-5">
                          {groupSessionsByDate(tutorSessions).map(
                            ({ date, sessions: dateSessions }) => (
                              <div key={date}>
                                <h5 className="mb-3 text-sm font-medium">
                                  {formatDate(date)}
                                </h5>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  {dateSessions.map((session) => {
                                    const selected = selectedSession === session.id

                                    return (
                                      <button
                                        key={session.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => {
                                          setSelectedSession(session.id)
                                          setSuccess('')
                                          setError('')
                                        }}
                                        className={`rounded-xl border p-4 text-left transition ${
                                          selected
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'bg-white hover:border-primary/40'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold">
                                              {formatTime(session.start_time)} –{' '}
                                              {formatTime(session.end_time)}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              {SESSION_DESCRIPTIONS[session.session_type]}
                                            </p>
                                          </div>

                                          <Badge
                                            variant={selected ? 'default' : 'secondary'}
                                          >
                                            {SESSION_LABELS[session.session_type]}
                                          </Badge>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Confirmation */}
        {selectedSessionData && selectedTutorData && selectedSubjectData && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                3
              </div>
              <div>
                <h2 className="text-lg font-semibold">Confirm your session</h2>
                <p className="text-sm text-muted-foreground">
                  Review the details before booking.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-muted/30 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>
                  {SESSION_LABELS[selectedSessionData.session_type]}
                </Badge>
                <Badge variant="secondary">{selectedSubjectData.name}</Badge>
              </div>

              <p className="mt-4 text-xl font-semibold">
                {formatDate(selectedSessionData.session_date)}
              </p>
              <p className="mt-1 text-lg">
                {formatTime(selectedSessionData.start_time)} –{' '}
                {formatTime(selectedSessionData.end_time)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {SESSION_DESCRIPTIONS[selectedSessionData.session_type]}
              </p>

              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">Tutor</p>
                <p className="font-medium">{selectedTutorData.name}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                className="sm:min-w-48"
                onClick={() => void bookSession()}
                disabled={booking}
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setSelectedSession(null)}
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isCancelledBooking(status: string | null | undefined) {
  const normalized = status?.toLowerCase().trim()
  return normalized === 'cancelled' || normalized === 'canceled'
}

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

function compareSessions(a: BookableSession, b: BookableSession) {
  const dateComparison = a.session_date.localeCompare(b.session_date)

  if (dateComparison !== 0) return dateComparison

  return a.start_time.localeCompare(b.start_time)
}

function groupSessionsByDate(sessions: BookableSession[]) {
  const groups = new Map<string, BookableSession[]>()

  for (const session of [...sessions].sort(compareSessions)) {
    const current = groups.get(session.session_date) || []
    current.push(session)
    groups.set(session.session_date, current)
  }

  return Array.from(groups.entries()).map(([date, dateSessions]) => ({
    date,
    sessions: dateSessions,
  }))
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function formatWeekdayLong(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
  })
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

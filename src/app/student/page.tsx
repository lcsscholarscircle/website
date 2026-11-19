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
  subject: string | null
  bookable_sessions: {
    id: string
    session_type: 'lfp' | 'virtual' | 'library'
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

type StudentProfile = {
  id: string
  role: string
  grade: number | null
  subjects: string[] | null
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

  /*
   * Student account information.
   */

  const [profile, setProfile] =
    useState<StudentProfile | null>(null)

  const [profileLoading, setProfileLoading] =
    useState(true)

  const [savingProfile, setSavingProfile] =
    useState(false)

  const [profileError, setProfileError] =
    useState('')

  const [grade, setGrade] =
    useState('')

  const [showTutorApplication, setShowTutorApplication] =
    useState(false)

  const [selectedTutorSubjects, setSelectedTutorSubjects] =
    useState<string[]>([])

  const [tutorApplicationInformation, setTutorApplicationInformation] =
    useState('')

  const [tutorTermsAccepted, setTutorTermsAccepted] =
    useState(false)

  const [submittingTutorApplication, setSubmittingTutorApplication] =
    useState(false)

  const [tutorApplicationError, setTutorApplicationError] =
    useState('')

  const [tutorApplicationSuccess, setTutorApplicationSuccess] =
    useState(false)

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

    setProfileLoading(true)
    setProfileError('')

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select(`
        id,
        role,
        grade,
        subjects
      `)
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(profileError)

      setError(profileError.message)
      setProfileError(
        'Unable to load your account information.'
      )
    } else {
      setProfile(profileData)

      setGrade(
        profileData.grade !== null
          ? String(profileData.grade)
          : ''
      )

      setStudentSubjects(
        profileData.subjects || []
      )
    }

    setProfileLoading(false)

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
        subject,

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

    setLoading(false)
  }

  async function saveProfile() {
    if (!profile) {
      return
    }

    setSavingProfile(true)
    setProfileError('')

    const parsedGrade = Number(grade)

    if (!grade || Number.isNaN(parsedGrade)) {
      setProfileError(
        'Please enter your grade.'
      )

      setSavingProfile(false)
      return
    }

    const {
      data,
      error: updateError,
    } = await supabase
      .from('profiles')
      .update({
        grade: parsedGrade,
      })
      .eq('id', profile.id)
      .select(`
        id,
        role,
        grade,
        subjects
      `)
      .single()

    if (updateError) {
      console.error(updateError)

      setProfileError(
        'Unable to save your grade. Please try again.'
      )

      setSavingProfile(false)
      return
    }

    setProfile(data)

    setGrade(
      data.grade !== null
        ? String(data.grade)
        : ''
    )

    setSavingProfile(false)
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

    setCancelling(null)

    /*
     * Instead of removing the booking from the local
     * page immediately, reload the dashboard.
     */

    await loadDashboard()
  }

  async function submitTutorApplication() {
    setTutorApplicationError('')

    if (selectedTutorSubjects.length === 0) {
      setTutorApplicationError(
        'Please select at least one subject.'
      )
      return
    }

    if (!tutorApplicationInformation.trim()) {
      setTutorApplicationError(
        'Please explain why you want to become a tutor.'
      )
      return
    }

    if (!tutorTermsAccepted) {
      setTutorApplicationError(
        'You must agree to the terms before submitting.'
      )
      return
    }

    setSubmittingTutorApplication(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setTutorApplicationError(
        'Unable to identify your account. Please sign in again.'
      )
      setSubmittingTutorApplication(false)
      return
    }

    const information = [
      'Why I want to be a tutor:',
      tutorApplicationInformation.trim(),
      '',
      'Terms agreement:',
      'The applicant checked the agreement checkbox and accepted the displayed tutor application terms.',
    ].join('\n')

    const { error: insertError } = await supabase
      .from('requests')
      .insert({
        requester: user.id,
        type: 'tutor_application',
        subjects: selectedTutorSubjects,
        information,
      })

    if (insertError) {
      console.error('TUTOR APPLICATION ERROR:', insertError)

      setTutorApplicationError(
        insertError.message ||
          'Unable to submit your application. Please try again.'
      )

      setSubmittingTutorApplication(false)
      return
    }

    setTutorApplicationSuccess(true)
    setSubmittingTutorApplication(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  /*
   * Only show sessions that haven't happened yet
   * and that aren't cancelled.
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

  /*
   * Determine whether the account completion panel
   * should be displayed.
   */

  const missingGrade =
    profile?.grade === null

  const showProfilePanel =
    !profileLoading &&
    profile?.role === 'student' &&
    missingGrade

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

      {/* TUTOR APPLICATION MODAL */}

      {showTutorApplication && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">

          <div className="my-auto w-full max-w-2xl rounded-2xl border bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-start justify-between border-b p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Tutor Application
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us a little about yourself and the subjects you'd like to tutor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTutorApplication(false)}
                className="rounded-lg px-3 py-1 text-xl text-muted-foreground transition hover:bg-muted"
                aria-label="Close application"
              >
                ×
              </button>
            </div>

            {tutorApplicationSuccess ? (
              <div className="p-8 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
                  ✓
                </div>

                <h3 className="mt-4 text-lg font-semibold">
                  Application submitted!
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  Thank you for your interest in becoming a Scholar&apos;s Circle tutor. Your application has been sent to our leadership team for review.
                </p>

                <Button
                  className="mt-6"
                  onClick={() => {
                    setShowTutorApplication(false)
                    setSelectedTutorSubjects([])
                    setTutorApplicationInformation('')
                    setTutorTermsAccepted(false)
                    setTutorApplicationSuccess(false)
                  }}
                >
                  Close
                </Button>

              </div>
            ) : (

              <div className="space-y-6 p-6">

                {/* SUBJECT SELECTION */}

                <div>
                  <h3 className="font-semibold">
                    Subjects you can tutor
                  </h3>

                  <p className="mb-3 mt-1 text-sm text-muted-foreground">
                    Select all subjects you feel comfortable tutoring.
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">

                    {subjects.map((subject) => {
                      const selected =
                        selectedTutorSubjects.includes(subject.id)

                      return (
                        <label
                          key={subject.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedTutorSubjects((current) => [
                                  ...current,
                                  subject.id,
                                ])
                              } else {
                                setSelectedTutorSubjects((current) =>
                                  current.filter(
                                    (id) => id !== subject.id
                                  )
                                )
                              }
                            }}
                            className="h-4 w-4 accent-primary"
                          />

                          <span className="text-sm font-medium">
                            {subject.name}
                          </span>
                        </label>
                      )
                    })}

                  </div>

                  {subjects.length === 0 && (
                    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      No subjects are currently available.
                    </p>
                  )}
                </div>

                {/* WRITTEN RESPONSE */}

                <div>
                  <label
                    htmlFor="tutor-application-information"
                    className="font-semibold"
                  >
                    Why do you want to be a tutor?
                  </label>

                  <p className="mb-3 mt-1 text-sm text-muted-foreground">
                    Explain why you're interested in tutoring. Please include any previous tutoring, teaching, academic, or other relevant experience.
                  </p>

                  <textarea
                    id="tutor-application-information"
                    value={tutorApplicationInformation}
                    onChange={(event) =>
                      setTutorApplicationInformation(event.target.value)
                    }
                    placeholder="Tell us about yourself, why you want to tutor, and any relevant experience..."
                    rows={6}
                    className="w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* TERMS AGREEMENT */}

                <div className="rounded-xl border bg-muted/30 p-4">

                  <h3 className="font-semibold">
                    Tutor Agreement
                  </h3>

                  <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-white p-3 text-sm leading-relaxed text-muted-foreground">
                    1. You must let Scholar's Circle (scholarscircle@larchmontcharter.org) and your student know 24 hours beforehand if you will not be able to make your booked session.
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-white p-3 text-sm leading-relaxed text-muted-foreground">
                    2. Check your email often for session bookings. You will be able to indicate your availability on the website Tutor Portal (once we approve you). You should be available or are able to become available on short notice during those time periods.
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-white p-3 text-sm leading-relaxed text-muted-foreground">
                    3. You must keep constant contact with your student (or parent) for any rescheduling, absences, tardies, etc. You should contact a Scholar's Circle leader FIRST, and we will advise you on how to proceed. We recommend you use Google Calendar to organize your tutoring sessions. We will send you Google Calendar invites for any online sessions you schedule.
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={tutorTermsAccepted}
                      onChange={(event) =>
                        setTutorTermsAccepted(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 accent-primary"
                    />

                    <span className="text-sm">
                      I have read and agree to the Scholar&apos;s Circle tutor terms and conditions.
                    </span>
                  </label>

                </div>

                {/* ERROR */}

                {tutorApplicationError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {tutorApplicationError}
                  </div>
                )}

                {/* ACTIONS */}

                <div className="flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTutorApplication(false)}
                    disabled={submittingTutorApplication}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    onClick={submitTutorApplication}
                    disabled={
                      submittingTutorApplication ||
                      subjects.length === 0
                    }
                  >
                    {submittingTutorApplication
                      ? 'Submitting...'
                      : 'Submit Application'}
                  </Button>

                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ACCOUNT COMPLETION PANEL */}

      {showProfilePanel && (
        <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-6 sm:w-[420px]">
          <div className="rounded-2xl border bg-white p-6 shadow-2xl">

            <div className="mb-5">
              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                  👋
                </div>

                <div>
                  <h2 className="font-semibold">
                    Complete your account
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    We need a little more information before you can use your student account.
                  </p>
                </div>

              </div>
            </div>

            <div className="space-y-4">

              {missingGrade && (
                <div>
                  <label
                    htmlFor="student-grade"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Grade
                  </label>

                  <input
                    id="student-grade"
                    type="number"
                    min="1"
                    max="12"
                    value={grade}
                    onChange={(event) =>
                      setGrade(event.target.value)
                    }
                    placeholder="e.g. 10"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {profileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingProfile
                  ? 'Saving...'
                  : 'Save account information'}
              </button>

            </div>
          </div>
        </div>
      )}

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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">

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
                '/student/sessions'
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

          <button
            type="button"
            onClick={() => {
              setShowTutorApplication(true)
              setTutorApplicationError('')
              setTutorApplicationSuccess(false)
            }}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                🎓
              </div>

              <div>
                <p className="font-semibold">
                  Apply to be a tutor!
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Apply to join Scholar&apos;s Circle as a tutor.
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
          
            {booking.subject && (
              <Badge variant="secondary">
                {booking.subject}
              </Badge>
            )}
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
    | 'lfp'
    | 'virtual'
    | 'library'
) {
  switch (type) {
    case 'lfp':
      return 'LFP'

    case 'virtual':
      return 'Virtual'

    case 'library':
      return 'Library'

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

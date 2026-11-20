
'use client'

import { useEffect, useMemo, useState } from 'react'

import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Profile = {
  id: string
  name: string
  email: string
  grade: number | null
  phone_number: string | null
}

type BookableSession = {
  id: string
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
  status: 'confirmed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
  student: Profile
  tutor: Profile
  session: BookableSession
}

type StatusFilter = 'all' | 'confirmed' | 'cancelled'
type TimeFilter = 'all' | 'upcoming' | 'past'

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')
  const [timeFilter, setTimeFilter] =
    useState<TimeFilter>('upcoming')

  const [selectedBooking, setSelectedBooking] =
    useState<Booking | null>(null)

  const [cancelling, setCancelling] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const [sessionLink, setSessionLink] = useState('')
  const [loadingLink, setLoadingLink] = useState(false)
  const [savingLink, setSavingLink] = useState(false)

  // --------------------------------------------------
  // LOAD BOOKINGS
  // --------------------------------------------------

  async function loadBookings() {
    setLoading(true)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        session_id,
        student_id,
        tutor_id,
        status,
        notes,
        created_at,
        updated_at,
        student:profiles!bookings_student_id_fkey (
          id,
          name,
          email,
          grade
        ),
        tutor:profiles!bookings_tutor_id_fkey (
          id,
          name,
          email,
          grade,
          phone_number
        ),
        session:bookable_sessions!bookings_session_id_fkey (
          id,
          session_type,
          session_date,
          start_time,
          end_time,
          slot_index
        )
      `)

    if (error) {
      console.error(error)
      alert(error.message)
      setLoading(false)
      return
    }

    const sortedBookings = [
      ...((data ?? []) as unknown as Booking[]),
    ].sort((a, b) => {
      const dateA = a.session.session_date
      const dateB = b.session.session_date

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB)
      }

      return a.session.start_time.localeCompare(
        b.session.start_time
      )
    })

    setBookings(sortedBookings)
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [])

  // --------------------------------------------------
  // LOAD SESSION LINK
  // --------------------------------------------------

  useEffect(() => {
    let active = true

    async function loadSessionLink() {
      if (!selectedBooking) {
        setSessionLink('')
        return
      }

      setLoadingLink(true)
      setSessionLink('')

      const { data, error } = await supabase
        .from('notifications')
        .select('id, link')
        .eq('session_id', selectedBooking.session_id)
        .eq('notification_type', 'session_reminder')

      if (!active) return

      if (error) {
        console.error('Error loading session link:', error)
        alert(`Could not load session link: ${error.message}`)
        setLoadingLink(false)
        return
      }

      const existingLink =
        data?.find((notification) => notification.link?.trim())
          ?.link ?? ''

      setSessionLink(existingLink)
      setLoadingLink(false)
    }

    loadSessionLink()

    return () => {
      active = false
    }
  }, [selectedBooking])

  // --------------------------------------------------
  // FORMATTING HELPERS
  // --------------------------------------------------

  function formatDate(dateString: string) {
    const date = new Date(`${dateString}T12:00:00`)

    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function formatTime(timeString: string) {
    const [hours, minutes] = timeString.split(':').map(Number)

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function getSessionTypeLabel(
    sessionType: BookableSession['session_type']
  ) {
    switch (sessionType) {
      case 'library':
        return 'Library'
      case 'lfp':
        return 'LFP'
      case 'virtual':
        return 'Virtual'
    }
  }

  function getSessionTypeBadge(
    sessionType: BookableSession['session_type']
  ) {
    switch (sessionType) {
      case 'library':
        return <Badge>Library</Badge>

      case 'lfp':
        return <Badge variant="secondary">LFP</Badge>

      case 'virtual':
        return <Badge variant="outline">Virtual</Badge>
    }
  }

  function getStatusBadge(status: Booking['status']) {
    if (status === 'confirmed') {
      return <Badge>Confirmed</Badge>
    }

    return (
      <Badge variant="destructive">
        Cancelled
      </Badge>
    )
  }

  function isUpcoming(booking: Booking) {
    const session = booking.session

    const sessionDateTime = new Date(
      `${session.session_date}T${session.start_time}`
    )

    return sessionDateTime >= new Date()
  }

  // --------------------------------------------------
  // FILTER BOOKINGS
  // --------------------------------------------------

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return bookings.filter((booking) => {
      if (
        statusFilter !== 'all' &&
        booking.status !== statusFilter
      ) {
        return false
      }

      if (
        timeFilter === 'upcoming' &&
        !isUpcoming(booking)
      ) {
        return false
      }

      if (
        timeFilter === 'past' &&
        isUpcoming(booking)
      ) {
        return false
      }

      if (normalizedSearch) {
        const matchesSearch =
          booking.student.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          booking.student.email
            .toLowerCase()
            .includes(normalizedSearch) ||
          booking.tutor.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          booking.tutor.email
            .toLowerCase()
            .includes(normalizedSearch) ||
          getSessionTypeLabel(
            booking.session.session_type
          )
            .toLowerCase()
            .includes(normalizedSearch)

        if (!matchesSearch) {
          return false
        }
      }

      return true
    })
  }, [bookings, search, statusFilter, timeFilter])

  // --------------------------------------------------
  // CANCEL BOOKING
  // --------------------------------------------------

  async function cancelBooking() {
    if (!selectedBooking) return

    setCancelling(true)

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedBooking.id)

    if (error) {
      console.error(error)
      alert(error.message)
      setCancelling(false)
      return
    }

    setCancelling(false)
    setSelectedBooking(null)

    await loadBookings()
  }

  // --------------------------------------------------
  // RESTORE BOOKING
  // --------------------------------------------------

  async function restoreBooking() {
    if (!selectedBooking) return

    setRestoring(true)

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedBooking.id)

    if (error) {
      console.error(error)
      alert(error.message)
      setRestoring(false)
      return
    }

    setRestoring(false)
    setSelectedBooking(null)

    await loadBookings()
  }

  // --------------------------------------------------
  // SAVE SESSION LINK
  // --------------------------------------------------

  async function saveSessionLink() {
    if (!selectedBooking) return

    const newLink = sessionLink.trim()

    setSavingLink(true)

    try {
      const { data: reminders, error: fetchError } =
        await supabase
          .from('notifications')
          .select('id')
          .eq('session_id', selectedBooking.session_id)
          .eq('notification_type', 'session_reminder')

      if (fetchError) {
        throw fetchError
      }

      if (!reminders || reminders.length === 0) {
        throw new Error(
          'No session_reminder notifications were found for this session.'
        )
      }

      const { data: updatedReminders, error: updateError } =
        await supabase
          .from('notifications')
          .update({ link: newLink || null })
          .eq('session_id', selectedBooking.session_id)
          .eq('notification_type', 'session_reminder')
          .select('id')

      if (updateError) {
        throw updateError
      }

      if (
        !updatedReminders ||
        updatedReminders.length !== reminders.length
      ) {
        throw new Error(
          `Expected to update ${reminders.length} reminder(s), ` +
          `but updated ${updatedReminders?.length ?? 0}. ` +
          'Check your Supabase permissions and try again.'
        )
      }

      alert('Session link saved successfully.')
    } catch (error) {
      console.error('Error saving session link:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'Could not save the session link.'
      )
    } finally {
      setSavingLink(false)
    }
  }

  // --------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------

  if (loading) {
    return (
      <DashboardLayout role="leader">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Loading bookings...
          </p>
        </div>
      </DashboardLayout>
    )
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <DashboardLayout role="leader">
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">

        {/* PAGE HEADER */}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Bookings
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              View and manage Scholar&apos;s Circle bookings.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={loadBookings}
            className="w-full sm:w-auto"
          >
            Refresh Bookings
          </Button>
        </div>

        {/* FILTERS */}

        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-5">

            {/* SEARCH */}

            <div>
              <label
                htmlFor="booking-search"
                className="mb-2 block text-sm font-medium"
              >
                Search bookings
              </label>

              <input
                id="booking-search"
                type="text"
                placeholder="Search students or tutors..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-lg border bg-background px-3 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* DATE FILTER */}

            <div>
              <p className="mb-2 text-sm font-medium">
                Date
              </p>

              <div className="grid grid-cols-3 gap-2 sm:flex">
                {([
                  ['upcoming', 'Upcoming'],
                  ['past', 'Past'],
                  ['all', 'All Dates'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    className="w-full sm:w-auto"
                    variant={
                      timeFilter === value
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setTimeFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* STATUS FILTER */}

            <div>
              <p className="mb-2 text-sm font-medium">
                Status
              </p>

              <div className="flex flex-wrap gap-2">
                {([
                  ['all', 'All'],
                  ['confirmed', 'Confirmed'],
                  ['cancelled', 'Cancelled'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={
                      statusFilter === value
                        ? 'secondary'
                        : 'ghost'
                    }
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RESULTS SUMMARY */}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {filteredBookings.length}
              </span>{' '}
              {filteredBookings.length === 1
                ? 'booking'
                : 'bookings'}
            </p>
          </div>

          {(search ||
            statusFilter !== 'all' ||
            timeFilter !== 'upcoming') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setTimeFilter('upcoming')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* BOOKING LIST */}

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center sm:py-20">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="2"
                  />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                  <path d="m9 16 2 2 4-4" />
                </svg>
              </div>

              <p className="font-semibold">
                No bookings found
              </p>

              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Try changing your filters or search for a different student or tutor.
              </p>

              {(search ||
                statusFilter !== 'all' ||
                timeFilter !== 'upcoming') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setTimeFilter('upcoming')
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedBooking(booking)}
                  className="block w-full text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

                    {/* STUDENT / TUTOR */}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold break-words">
                          {booking.student.name}
                        </p>

                        <span className="text-muted-foreground">
                          →
                        </span>

                        <p className="font-medium break-words">
                          {booking.tutor.name}
                        </p>
                      </div>

                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        {booking.student.email}
                      </p>

                      <div className="mt-2">
                        {getStatusBadge(booking.status)}
                      </div>
                    </div>

                    {/* SESSION INFORMATION */}

                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start lg:min-w-[260px] lg:justify-end">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {getSessionTypeBadge(
                            booking.session.session_type
                          )}

                          <span className="text-sm font-medium">
                            {formatDate(
                              booking.session.session_date
                            )}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {formatTime(
                            booking.session.start_time
                          )}{' '}
                          –{' '}
                          {formatTime(
                            booking.session.end_time
                          )}
                        </p>
                      </div>

                      <span className="hidden text-muted-foreground sm:inline">
                        →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------
          BOOKING DETAIL DIALOG
      ------------------------------------------------ */}

      <Dialog
        open={selectedBooking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBooking(null)
          }
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">

          {/* FIXED HEADER */}

          <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
            <DialogTitle className="text-lg">
              Booking Details
            </DialogTitle>

            <DialogDescription>
              View and manage this Scholar&apos;s Circle booking.
            </DialogDescription>
          </DialogHeader>

          {/* SCROLLABLE CONTENT */}

          {selectedBooking && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
              <div className="space-y-5 py-5">

                {/* STATUS */}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Status
                    </p>

                    <div className="mt-1">
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                  </div>

                  {getSessionTypeBadge(
                    selectedBooking.session.session_type
                  )}
                </div>

                {/* STUDENT AND TUTOR */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  {/* STUDENT */}

                  <div className="min-w-0">
                    <p className="mb-2 text-sm font-semibold">
                      Student
                    </p>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="font-medium break-words">
                        {selectedBooking.student.name}
                      </p>

                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        {selectedBooking.student.email}
                      </p>

                      {selectedBooking.student.grade !== null && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Grade {selectedBooking.student.grade}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* TUTOR */}

                  <div className="min-w-0">
                    <p className="mb-2 text-sm font-semibold">
                      Tutor
                    </p>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="font-medium break-words">
                        {selectedBooking.tutor.name}
                      </p>

                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        {selectedBooking.tutor.email}
                      </p>

                      {selectedBooking.tutor.grade !== null && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Grade {selectedBooking.tutor.grade}
                        </p>
                      )}

                      {selectedBooking.tutor.phone_number !== null && (
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {selectedBooking.tutor.phone_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SESSION */}

                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Session
                  </p>

                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium">
                      {formatDate(
                        selectedBooking.session.session_date
                      )}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatTime(
                        selectedBooking.session.start_time
                      )}{' '}
                      –{' '}
                      {formatTime(
                        selectedBooking.session.end_time
                      )}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {getSessionTypeLabel(
                        selectedBooking.session.session_type
                      )}
                    </p>
                  </div>
                </div>

                {/* SESSION LINK */}

                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Session Link
                  </p>

                  {loadingLink ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      Loading session link...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={sessionLink}
                        onChange={(event) =>
                          setSessionLink(event.target.value)
                        }
                        placeholder="Enter session link..."
                        disabled={savingLink}
                        className="w-full min-w-0 rounded-lg border bg-background px-3 py-3 text-base outline-none transition focus:ring-2 focus:ring-ring"
                      />

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="w-full sm:w-auto"
                          onClick={saveSessionLink}
                          disabled={savingLink || loadingLink}
                        >
                          {savingLink ? 'Saving...' : 'Save Link'}
                        </Button>

                        {sessionLink.trim() && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() =>
                              window.open(
                                sessionLink,
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                            disabled={savingLink}
                          >
                            Open Link
                          </Button>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Saving updates the session&apos;s reminder notifications.
                        Leave the field empty and save to clear the existing link.
                      </p>
                    </div>
                  )}
                </div>

                {/* NOTES */}

                {selectedBooking.notes && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">
                      Notes
                    </p>

                    <div className="break-words whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                      {selectedBooking.notes}
                    </div>
                  </div>
                )}

                {/* CREATED */}

                <div className="border-t pt-4 text-xs text-muted-foreground">
                  Booked{' '}
                  {new Date(
                    selectedBooking.created_at
                  ).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* FIXED FOOTER */}

          <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:px-6">
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => setSelectedBooking(null)}
              disabled={cancelling || restoring}
            >
              Close
            </Button>

            {selectedBooking?.status === 'confirmed' && (
              <Button
                className="w-full sm:w-auto"
                variant="destructive"
                onClick={cancelBooking}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </Button>
            )}

            {selectedBooking?.status === 'cancelled' && (
              <Button
                className="w-full sm:w-auto"
                onClick={restoreBooking}
                disabled={restoring}
              >
                {restoring ? 'Restoring...' : 'Restore Booking'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

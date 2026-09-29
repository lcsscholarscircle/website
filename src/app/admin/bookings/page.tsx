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
}

type BookableSession = {
  id: string
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
          grade
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      alert(error.message)
      setLoading(false)
      return
    }

    setBookings((data ?? []) as unknown as Booking[])
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [])

  function formatDate(dateString: string) {
    // Add the time portion so the date doesn't shift because of
    // UTC conversion.
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
      case 'official':
        return 'Official'
      case 'lunch':
        return 'Lunch'
      case 'zoom':
        return 'Zoom'
    }
  }

  function getSessionTypeBadge(
    sessionType: BookableSession['session_type']
  ) {
    switch (sessionType) {
      case 'official':
        return <Badge>Official</Badge>

      case 'lunch':
        return (
          <Badge variant="secondary">
            Lunch
          </Badge>
        )

      case 'zoom':
        return (
          <Badge variant="outline">
            Zoom
          </Badge>
        )
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

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return bookings.filter((booking) => {
      // Status filter
      if (
        statusFilter !== 'all' &&
        booking.status !== statusFilter
      ) {
        return false
      }

      // Time filter
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

      // Search
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
          getSessionTypeLabel(booking.session.session_type)
            .toLowerCase()
            .includes(normalizedSearch)

        if (!matchesSearch) {
          return false
        }
      }

      return true
    })
  }, [
    bookings,
    search,
    statusFilter,
    timeFilter,
  ])

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

  if (loading) {
    return (
      <DashboardLayout role="leader">
        <p>Loading...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="leader">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Bookings
        </h1>

        <p className="mt-1 text-muted-foreground">
          View and manage Scholar&apos;s Circle bookings.
        </p>
      </div>

      {/* FILTERS */}
      <section className="mb-6 rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* SEARCH */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search students or tutors..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={
                timeFilter === 'upcoming'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setTimeFilter('upcoming')
              }
            >
              Upcoming
            </Button>

            <Button
              size="sm"
              variant={
                timeFilter === 'past'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setTimeFilter('past')
              }
            >
              Past
            </Button>

            <Button
              size="sm"
              variant={
                timeFilter === 'all'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setTimeFilter('all')
              }
            >
              All Dates
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={
              statusFilter === 'all'
                ? 'secondary'
                : 'ghost'
            }
            onClick={() =>
              setStatusFilter('all')
            }
          >
            All
          </Button>

          <Button
            size="sm"
            variant={
              statusFilter === 'confirmed'
                ? 'secondary'
                : 'ghost'
            }
            onClick={() =>
              setStatusFilter('confirmed')
            }
          >
            Confirmed
          </Button>

          <Button
            size="sm"
            variant={
              statusFilter === 'cancelled'
                ? 'secondary'
                : 'ghost'
            }
            onClick={() =>
              setStatusFilter('cancelled')
            }
          >
            Cancelled
          </Button>
        </div>
      </section>

      {/* SUMMARY */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">
            {filteredBookings.length}
          </span>{' '}
          {filteredBookings.length === 1
            ? 'booking'
            : 'bookings'}
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={loadBookings}
        >
          Refresh
        </Button>
      </div>

      {/* BOOKINGS */}
      <section className="overflow-hidden rounded-xl border bg-white">
        {filteredBookings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">
              No bookings found.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Try changing your filters or search.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredBookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() =>
                  setSelectedBooking(booking)
                }
                className="block w-full text-left transition hover:bg-gray-50"
              >
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  {/* STUDENT / TUTOR */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {booking.student.name}
                      </p>

                      <span className="text-muted-foreground">
                        →
                      </span>

                      <p className="font-medium">
                        {booking.tutor.name}
                      </p>

                      {getStatusBadge(
                        booking.status
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking.student.email}
                    </p>
                  </div>

                  {/* SESSION */}
                  <div className="flex flex-col gap-2 lg:min-w-[260px] lg:items-end">
                    <div className="flex items-center gap-2">
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
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* BOOKING DETAIL DIALOG */}
      <Dialog
        open={selectedBooking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBooking(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Booking Details
            </DialogTitle>

            <DialogDescription>
              View and manage this Scholar&apos;s Circle
              booking.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6 py-4">
              {/* STATUS */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Status
                  </p>

                  <div className="mt-1">
                    {getStatusBadge(
                      selectedBooking.status
                    )}
                  </div>
                </div>

                <div>
                  {getSessionTypeBadge(
                    selectedBooking.session.session_type
                  )}
                </div>
              </div>

              {/* STUDENT */}
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Student
                </p>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">
                    {selectedBooking.student.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.student.email}
                  </p>

                  {selectedBooking.student.grade !==
                    null && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Grade {selectedBooking.student.grade}
                    </p>
                  )}
                </div>
              </div>

              {/* TUTOR */}
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Tutor
                </p>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">
                    {selectedBooking.tutor.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.tutor.email}
                  </p>
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
                      selectedBooking.session
                        .session_date
                    )}
                  </p>

                  <p className="text-sm text-muted-foreground">
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
                      selectedBooking.session
                        .session_type
                    )}
                  </p>
                </div>
              </div>

              {/* NOTES */}
              {selectedBooking.notes && (
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Notes
                  </p>

                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    {selectedBooking.notes}
                  </div>
                </div>
              )}

              {/* CREATED */}
              <div className="text-xs text-muted-foreground">
                Booked{' '}
                {new Date(
                  selectedBooking.created_at
                ).toLocaleString()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSelectedBooking(null)
              }
              disabled={cancelling || restoring}
            >
              Close
            </Button>

            {selectedBooking?.status ===
              'confirmed' && (
              <Button
                variant="destructive"
                onClick={cancelBooking}
                disabled={cancelling}
              >
                {cancelling
                  ? 'Cancelling...'
                  : 'Cancel Booking'}
              </Button>
            )}

            {selectedBooking?.status ===
              'cancelled' && (
              <Button
                onClick={restoreBooking}
                disabled={restoring}
              >
                {restoring
                  ? 'Restoring...'
                  : 'Restore Booking'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ScheduleWindow = {
  id: string
  name: string
  session_type: 'lunch' | 'official'
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  active: boolean
}

type Availability = {
  id: string
  session_type: 'lunch' | 'zoom' | 'official'
  schedule_window_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string | null
  active: boolean
}

const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const times = generateTimes()

export default function AvailabilityPage() {
  const [windows, setWindows] = useState<ScheduleWindow[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])

  const [loading, setLoading] = useState(true)

  const [zoomDialogOpen, setZoomDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [zoomDay, setZoomDay] = useState('')
  const [zoomStart, setZoomStart] = useState('')
  const [zoomEnd, setZoomEnd] = useState('')
  const [zoomStartDate, setZoomStartDate] = useState('')
  const [zoomEndDate, setZoomEndDate] = useState('')

  const [error, setError] = useState('')

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const [windowResult, availabilityResult] =
      await Promise.all([
        supabase
          .from('schedule_windows')
          .select('*')
          .eq('active', true)
          .order('start_date')
          .order('day_of_week')
          .order('start_time'),

        supabase
          .from('availability_rules')
          .select('*')
          .eq('tutor_id', user.id)
          .order('day_of_week')
          .order('start_time'),
      ])

    if (windowResult.error) {
      console.error(windowResult.error)
    }

    if (availabilityResult.error) {
      console.error(availabilityResult.error)
    }

    setWindows(windowResult.data || [])
    setAvailability(availabilityResult.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function isAvailableForWindow(
    window: ScheduleWindow
  ) {
    return availability.some(
      (item) =>
        item.schedule_window_id === window.id
    )
  }

  async function toggleSchoolAvailability(
    window: ScheduleWindow
  ) {
    const existing = availability.find(
      (item) =>
        item.schedule_window_id === window.id
    )

    if (existing) {
      const { error } = await supabase
        .from('availability_rules')
        .delete()
        .eq('id', existing.id)

      if (error) {
        alert(error.message)
        return
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase
        .from('availability_rules')
        .insert({
          tutor_id: user.id,
          session_type: window.session_type,
          schedule_window_id: window.id,
          day_of_week: window.day_of_week,
          start_time: window.start_time,
          end_time: window.end_time,
          start_date: window.start_date,
          end_date: window.end_date,
          active: true,
        })

      if (error) {
        alert(error.message)
        return
      }
    }

    await loadData()
  }

  function openZoomDialog() {
    setZoomDay('')
    setZoomStart('')
    setZoomEnd('')
    setZoomStartDate('')
    setZoomEndDate('')
    setError('')
    setZoomDialogOpen(true)
  }

  async function saveZoomAvailability() {
    setError('')

    if (
      !zoomDay ||
      !zoomStart ||
      !zoomEnd ||
      !zoomStartDate
    ) {
      setError('Please fill out all required fields.')
      return
    }

    if (zoomEnd <= zoomStart) {
      setError('End time must be after start time.')
      return
    }

    if (
      zoomEndDate &&
      zoomEndDate < zoomStartDate
    ) {
      setError(
        'End date must be after the start date.'
      )
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('availability_rules')
      .insert({
        tutor_id: user.id,
        session_type: 'zoom',
        schedule_window_id: null,
        day_of_week: Number(zoomDay),
        start_time: zoomStart,
        end_time: zoomEnd,
        start_date: zoomStartDate,
        end_date: zoomEndDate || null,
        active: true,
      })

    if (error) {
      console.error(error)
      setError(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setZoomDialogOpen(false)

    await loadData()
  }

  async function deleteZoomAvailability(
    id: string
  ) {
    const confirmed = confirm(
      'Delete this Zoom availability?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('availability_rules')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
  }

  const lunchWindows = windows.filter(
    (window) =>
      window.session_type === 'lunch'
  )

  const officialWindows = windows.filter(
    (window) =>
      window.session_type === 'official'
  )

  const zoomAvailability = availability.filter(
    (item) =>
      item.session_type === 'zoom'
  )

  if (loading) {
    return (
      <DashboardLayout role="tutor">
        <p>Loading...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="tutor">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          My Availability
        </h1>

        <p className="mt-1 text-muted-foreground">
          Choose when you are available to tutor.
        </p>
      </div>

      {/* LUNCH */}

      <ScheduleSection
        title="Lunch"
        description="Choose the lunch periods when you are available."
        windows={lunchWindows}
        isAvailable={isAvailableForWindow}
        onToggle={toggleSchoolAvailability}
      />

      {/* OFFICIAL */}

      <div className="mt-8">
        <ScheduleSection
          title="Official Scholar's Circle Sessions"
          description="These are tutoring periods designated by LCS leaders."
          windows={officialWindows}
          isAvailable={isAvailableForWindow}
          onToggle={toggleSchoolAvailability}
        />
      </div>

      {/* ZOOM */}

      <section className="mt-8 rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-semibold">
              Zoom Availability
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Add times when students can meet with you remotely.
            </p>
          </div>

          <Button onClick={openZoomDialog}>
            Add Zoom Availability
          </Button>
        </div>

        {zoomAvailability.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No Zoom availability.
          </p>
        ) : (
          <div className="divide-y">
            {zoomAvailability.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-5"
              >
                <div>
                  <p className="font-medium">
                    {days[item.day_of_week]} ·{' '}
                    {formatTime(item.start_time)}
                    {' - '}
                    {formatTime(item.end_time)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {formatDate(item.start_date)}
                    {item.end_date
                      ? ` · Until ${formatDate(item.end_date)}`
                      : ''}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    deleteZoomAvailability(item.id)
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ZOOM DIALOG */}

      <Dialog
        open={zoomDialogOpen}
        onOpenChange={setZoomDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Add Zoom Availability
            </DialogTitle>

            <DialogDescription>
              Choose a recurring time when students can book
              a Zoom tutoring session with you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Day</Label>

              <Select
                value={zoomDay}
                onValueChange={setZoomDay}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>

                <SelectContent>
                  {days.map((dayName, index) => (
                    <SelectItem
                      key={dayName}
                      value={String(index)}
                    >
                      {dayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start time</Label>

                <Select
                  value={zoomStart}
                  onValueChange={setZoomStart}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>

                  <SelectContent>
                    {times.map((time) => (
                      <SelectItem
                        key={time.value}
                        value={time.value}
                      >
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End time</Label>

                <Select
                  value={zoomEnd}
                  onValueChange={setZoomEnd}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="End" />
                  </SelectTrigger>

                  <SelectContent>
                    {times.map((time) => (
                      <SelectItem
                        key={time.value}
                        value={time.value}
                      >
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Available from</Label>

                <Input
                  type="date"
                  value={zoomStartDate}
                  onChange={(e) =>
                    setZoomStartDate(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Available until</Label>

                <Input
                  type="date"
                  value={zoomEndDate}
                  onChange={(e) =>
                    setZoomEndDate(e.target.value)
                  }
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setZoomDialogOpen(false)
              }
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              onClick={saveZoomAvailability}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function ScheduleSection({
  title,
  description,
  windows,
  isAvailable,
  onToggle,
}: {
  title: string
  description: string
  windows: ScheduleWindow[]
  isAvailable: (
    window: ScheduleWindow
  ) => boolean
  onToggle: (
    window: ScheduleWindow
  ) => void
}) {
  return (
    <section className="rounded-xl border bg-white">
      <div className="border-b p-5">
        <h2 className="font-semibold">
          {title}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      {windows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No times have been scheduled by leaders.
        </p>
      ) : (
        <div className="divide-y">
          {windows.map((window) => {
            const active = isAvailable(window)

            return (
              <div
                key={window.id}
                className="flex items-center justify-between p-5"
              >
                <div>
                  <p className="font-medium">
                    {days[window.day_of_week]} ·{' '}
                    {formatTime(window.start_time)}
                    {' - '}
                    {formatTime(window.end_time)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {formatDate(window.start_date)}
                    {' - '}
                    {formatDate(window.end_date)}
                  </p>
                </div>

                <Button
                  variant={
                    active
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() =>
                    onToggle(window)
                  }
                >
                  {active
                    ? 'Available'
                    : 'Make Available'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function generateTimes() {
  const result = []

  for (let hour = 7; hour <= 22; hour++) {
    for (const minute of [0, 15, 30, 45]) {
      if (hour === 22 && minute > 30) {
        continue
      }

      const value =
        `${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')}`

      const date = new Date()
      date.setHours(hour, minute)

      result.push({
        value,
        label: date.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }),
      })
    }
  }

  return result
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':')
  const date = new Date()

  date.setHours(
    Number(hours),
    Number(minutes)
  )

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(date: string) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString()
}
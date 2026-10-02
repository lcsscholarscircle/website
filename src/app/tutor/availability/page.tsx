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
  session_type: 'lfp' | 'library'
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  active: boolean
}

type Availability = {
  id: string
  session_type: 'lfp' | 'virtual' | 'library'
  schedule_window_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string | null
  duration_minutes: number
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

  const [virtDialogOpen, setVirtDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [virtDay, setVirtDay] = useState<string | null>(null)
  const [virtStart, setVirtStart] = useState<string | null>(null)
  const [virtEnd, setVirtEnd] = useState<string | null>(null)
  const [virtStartDate, setVirtStartDate] = useState<string | null>(null)
  const [virtEndDate, setVirtEndDate] = useState<string | null>(null)
  const [virtDuration, setVirtDuration] = useState<string>('30')

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

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

  /**
   * Generates sessions only for one availability rule.
   *
   * This replaces the old global:
   *   POST /api/generate-sessions
   *
   * Keeping the date as a local YYYY-MM-DD string
   * avoids the timezone/date-shift issue we previously
   * ran into with toISOString().
   */
  async function generateSessionsForRule(
    ruleId: string
  ) {
    const today = new Date()

    const year = today.getFullYear()
    const month = String(
      today.getMonth() + 1
    ).padStart(2, '0')
    const day = String(
      today.getDate()
    ).padStart(2, '0')

    const startDate =
      `${year}-${month}-${day}`

    const { error } = await supabase.rpc(
      'generate_sessions_for_rule',
      {
        p_rule_id: ruleId,
        p_start_date: startDate,
        p_days_ahead: 60,
      }
    )

    if (error) {
      throw error
    }
  }

  async function deleteAvailabilityRule(
    ruleId: string
  ) {
    const { data, error } =
      await supabase.rpc(
        'delete_availability_rule',
        {
          p_rule_id: ruleId,
        }
      )
  
    if (error) {
      throw error
    }
  
    return data
  }

  async function toggleSchoolAvailability(
    window: ScheduleWindow
  ) {
    if (togglingId === window.id) return

    setTogglingId(window.id)

    try {
      const existing = availability.find(
        (item) =>
          item.schedule_window_id === window.id
      )

      if (existing) {
        try {
          await deleteAvailabilityRule(existing.id)
        } catch (error) {
          console.error(
            'Failed to delete availability:',
            error
          )
        
          alert(
            error instanceof Error
              ? error.message
              : 'Failed to remove availability.'
          )
        
          return
        }
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          alert('You must be signed in.')
          return
        }

        const {
          data: newRule,
          error,
        } = await supabase
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
          .select('id')
          .single()

        if (error) {
          // Duplicate protection from the database
          if (error.code === '23505') {
            await loadData()
            return
          }

          alert(error.message)
          return
        }

        try {
          await generateSessionsForRule(
            newRule.id
          )
        } catch (generationError) {
          console.error(
            'Failed to generate sessions:',
            generationError
          )

          alert(
            generationError instanceof Error
              ? generationError.message
              : 'Availability was saved, but sessions could not be generated.'
          )

          return
        }
      }

      await loadData()
    } finally {
      setTogglingId(null)
    }
  }

  function openVirtDialog() {
    setVirtDay('')
    setVirtStart('')
    setVirtEnd('')
    setVirtStartDate('')
    setVirtEndDate('')
    setVirtDuration('30')
    setError('')
    setVirtDialogOpen(true)
  }

  async function saveVirtAvailability() {
    setError('')

    if (
      !virtDay ||
      !virtStart ||
      !virtEnd ||
      !virtStartDate
    ) {
      setError(
        'Please fill out all required fields.'
      )
      return
    }

    if (virtEnd <= virtStart) {
      setError(
        'End time must be after start time.'
      )
      return
    }

    if (
      virtEndDate &&
      virtEndDate < virtStartDate
    ) {
      setError(
        'End date must be after the start date.'
      )
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be signed in.')
        return
      }

      const {
        data: newRule,
        error,
      } = await supabase
        .from('availability_rules')
        .insert({
          tutor_id: user.id,
          session_type: 'virtual',
          schedule_window_id: null,
          day_of_week: Number(virtDay),
          start_time: virtStart,
          end_time: virtEnd,
          start_date: virtStartDate,
          end_date: virtEndDate || null,
          duration_minutes: Number(
            virtDuration
          ),
          active: true,
        })
        .select('id')
        .single()

      if (error) {
        console.error(error)
        setError(error.message)
        return
      }

      try {
        await generateSessionsForRule(
          newRule.id
        )
      } catch (generationError) {
        console.error(
          'Failed to generate sessions:',
          generationError
        )

        setError(
          generationError instanceof Error
            ? generationError.message
            : 'Availability was saved, but sessions could not be generated.'
        )

        return
      }

      setVirtDialogOpen(false)

      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function deleteVirtAvailability(
    id: string
  ) {
    const confirmed = confirm(
      'Delete this Virtual availability?'
    )

    if (!confirmed) return

    try {
      await deleteAvailabilityRule(id)
    } catch (error) {
      console.error(
        'Failed to delete availability:',
        error
      )
    
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to remove availability.'
      )
    
      return
    }
      
    await loadData()
  }

  const lfpWindows = windows.filter(
    (window) =>
      window.session_type === 'lfp'
  )

  const libraryWindows = windows.filter(
    (window) =>
      window.session_type === 'library'
  )

  const virtAvailability =
    availability.filter(
      (item) =>
        item.session_type === 'virtual'
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

      {/* LFP */}

      <ScheduleSection
        title="LFP Sessions"
        description="Choose the at-school times when you are available."
        windows={lfpWindows}
        isAvailable={isAvailableForWindow}
        onToggle={toggleSchoolAvailability}
        togglingId={togglingId}
      />

      {/* LIBRARY */}

      <ScheduleSection
        title="Library Sessions"
        description="These sessions will take place in-person, across the street at the library."
        windows={libraryWindows}
        isAvailable={isAvailableForWindow}
        onToggle={toggleSchoolAvailability}
        togglingId={togglingId}
      />

      {/* VIRTUAL */}

      <section className="mt-8 rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-semibold">
              Virtual Availability
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Add times when students can meet with you remotely.
            </p>
          </div>

          <Button onClick={openVirtDialog}>
            Add virtual Availability
          </Button>
        </div>

        {virtAvailability.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No virtual availability.
          </p>
        ) : (
          <div className="divide-y">
            {virtAvailability.map((item) => (
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
                    {item.duration_minutes}-minute sessions ·{' '}
                    {formatDate(item.start_date)}
                    {item.end_date
                      ? ` · Until ${formatDate(item.end_date)}`
                      : ''}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    deleteVirtAvailability(item.id)
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* VIRTUAL DIALOG */}

      <Dialog
        open={virtDialogOpen}
        onOpenChange={setVirtDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Add Virtual Availability
            </DialogTitle>

            <DialogDescription>
              Choose a recurring time when students can book
              a virtual tutoring session with you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Day</Label>

              <Select
                value={virtDay ?? ''}
                onValueChange={(value) =>
                  setVirtDay(value ?? '')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>

                <SelectContent>
                  {days.map(
                    (dayName, index) => (
                      <SelectItem
                        key={dayName}
                        value={String(index)}
                      >
                        {dayName}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start time</Label>

                <Select
                  value={virtStart ?? ''}
                  onValueChange={(value) =>
                    setVirtStart(value ?? '')
                  }
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
                  value={virtEnd ?? ''}
                  onValueChange={(value) =>
                    setVirtEnd(value ?? '')
                  }
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

            <div className="space-y-2">
              <Label>Session duration</Label>

              <Select
                value={virtDuration}
                onValueChange={(value) =>
                  setVirtDuration(value ?? '30')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="30">
                    30 minutes
                  </SelectItem>
                  <SelectItem value="45">
                    45 minutes
                  </SelectItem>
                  <SelectItem value="60">
                    60 minutes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Available from</Label>

                <Input
                  type="date"
                  value={virtStartDate ?? ''}
                  onChange={(e) =>
                    setVirtStartDate(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Available until</Label>

                <Input
                  type="date"
                  value={virtEndDate ?? ''}
                  onChange={(e) =>
                    setVirtEndDate(
                      e.target.value
                    )
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
                setVirtDialogOpen(false)
              }
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              onClick={saveVirtAvailability}
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Save Availability'}
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
  togglingId,
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
  togglingId: string | null
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
            const active =
              isAvailable(window)

            return (
              <div
                key={window.id}
                className="flex items-center justify-between p-5"
              >
                <div>
                  <p className="font-medium">
                    {days[window.day_of_week]} ·{' '}
                    {formatTime(
                      window.start_time
                    )}
                    {' - '}
                    {formatTime(
                      window.end_time
                    )}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {formatDate(
                      window.start_date
                    )}
                    {' - '}
                    {formatDate(
                      window.end_date
                    )}
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
                  disabled={
                    togglingId === window.id
                  }
                >
                  {togglingId === window.id
                    ? 'Saving...'
                    : active
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
    for (const minute of [
      0,
      15,
      30,
      45,
    ]) {
      if (
        hour === 22 &&
        minute > 30
      ) {
        continue
      }

      const value =
        `${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')}`

      const date = new Date()

      date.setHours(
        hour,
        minute
      )

      result.push({
        value,
        label: date.toLocaleTimeString(
          [],
          {
            hour: 'numeric',
            minute: '2-digit',
          }
        ),
      })
    }
  }

  return result
}

function formatTime(time: string) {
  const [hours, minutes] =
    time.split(':')

  const date = new Date()

  date.setHours(
    Number(hours),
    Number(minutes)
  )

  return date.toLocaleTimeString(
    [],
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}

function formatDate(date: string) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString()
}

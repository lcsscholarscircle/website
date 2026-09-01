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

export default function SchedulePage() {
  const [windows, setWindows] = useState<ScheduleWindow[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWindow, setEditingWindow] =
    useState<ScheduleWindow | null>(null)

  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [sessionType, setSessionType] = useState<
    'lunch' | 'official'
  >('official')

  const [day, setDay] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [error, setError] = useState('')

  async function loadWindows() {
    const { data, error } = await supabase
      .from('schedule_windows')
      .select('*')
      .order('start_date')
      .order('day_of_week')
      .order('start_time')

    if (error) {
      console.error(error)
      return
    }

    setWindows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadWindows()
  }, [])

  function resetForm() {
    setName('')
    setSessionType('official')
    setDay('')
    setStartTime('')
    setEndTime('')
    setStartDate('')
    setEndDate('')
    setError('')
    setEditingWindow(null)
  }

  function openAddDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(window: ScheduleWindow) {
    setEditingWindow(window)

    setName(window.name)
    setSessionType(window.session_type)
    setDay(String(window.day_of_week))
    setStartTime(window.start_time.slice(0, 5))
    setEndTime(window.end_time.slice(0, 5))
    setStartDate(window.start_date)
    setEndDate(window.end_date)

    setError('')
    setDialogOpen(true)
  }

  async function saveWindow() {
    setError('')

    if (
      !name ||
      !day ||
      !startTime ||
      !endTime ||
      !startDate ||
      !endDate
    ) {
      setError('Please fill out all fields.')
      return
    }

    if (endTime <= startTime) {
      setError('End time must be after start time.')
      return
    }

    if (endDate < startDate) {
      setError('End date must be after the start date.')
      return
    }

    setSaving(true)

    const windowData = {
      name,
      session_type: sessionType,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
      start_date: startDate,
      end_date: endDate,
    }

    let error

    if (editingWindow) {
      const result = await supabase
        .from('schedule_windows')
        .update(windowData)
        .eq('id', editingWindow.id)

      error = result.error
    } else {
      const result = await supabase
        .from('schedule_windows')
        .insert(windowData)

      error = result.error
    }

    if (error) {
      console.error(error)
      setError(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setDialogOpen(false)
    resetForm()

    await loadWindows()
  }

  async function deleteWindow(id: string) {
    const confirmed = confirm(
      'Delete this schedule window? Tutors who selected this window will no longer be available for it.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('schedule_windows')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadWindows()
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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            School Schedule
          </h1>

          <p className="mt-1 text-muted-foreground">
            Define when Scholar&apos;s Circle sessions can take place.
          </p>
        </div>

        <Button onClick={openAddDialog}>
          Add Schedule Window
        </Button>
      </div>

      <div className="space-y-4">
        {windows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="font-medium">
              No schedule windows yet.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Add lunch or official tutoring times.
            </p>
          </div>
        ) : (
          windows.map((window) => (
            <div
              key={window.id}
              className="flex items-center justify-between rounded-xl border bg-white p-6"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">
                    {window.name}
                  </h2>

                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {window.session_type === 'official'
                      ? 'Official'
                      : 'Lunch'}
                  </span>
                </div>

                <p className="mt-1">
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

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => openEditDialog(window)}
                >
                  Edit
                </Button>

                <Button
                  variant="outline"
                  onClick={() => deleteWindow(window.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)

          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingWindow
                ? 'Edit Schedule Window'
                : 'Add Schedule Window'}
            </DialogTitle>

            <DialogDescription>
              {editingWindow
                ? 'Update this Scholar&apos;s Circle schedule window.'
                : 'Define a recurring time when Scholar&apos;s Circle sessions can occur.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Name</Label>

              <Input
                placeholder="Official Tutoring"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Session type</Label>

              <Select
                value={sessionType}
                onValueChange={(value) =>
                  setSessionType(
                    value as 'lunch' | 'official'
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="official">
                    Official
                  </SelectItem>

                  <SelectItem value="lunch">
                    Lunch
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Day</Label>

              <Select
                value={day}
                onValueChange={setDay}
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
                  value={startTime}
                  onValueChange={setStartTime}
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
                  value={endTime}
                  onValueChange={setEndTime}
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
                <Label>From</Label>

                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Until</Label>

                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
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
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              onClick={saveWindow}
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editingWindow
                  ? 'Save Changes'
                  : 'Create Window'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
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
import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!

const supabaseServiceKey =
  process.env.SUPABASE_SECRET_KEY!

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey
)

type AvailabilityRule = {
  id: string
  tutor_id: string
  session_type: 'lunch' | 'zoom' | 'official'
  schedule_window_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string | null
  duration_minutes: number | null
  active: boolean
}

type ScheduleWindow = {
  id: string
  session_type: 'lunch' | 'official'
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  active: boolean
}

type ExistingSession = {
  id: string
  availability_rule_id: string
  schedule_window_id: string | null
  session_type: 'lunch' | 'zoom' | 'official'
  session_date: string
  start_time: string
  end_time: string
  slot_index: number
}

export async function generateSessions(
  daysAhead = 60
) {
  /*
   * IMPORTANT:
   *
   * All calendar calculations in this file use LOCAL
   * calendar dates rather than UTC dates.
   *
   * This prevents Monday availability from becoming
   * Sunday/Saturday because of timezone conversion.
   */

  const today = new Date()

  const todayString = formatLocalDate(today)

  const endDate = new Date(today)
  endDate.setHours(0, 0, 0, 0)
  endDate.setDate(
    endDate.getDate() + daysAhead
  )

  const endDateString =
    formatLocalDate(endDate)

  /*
   * Get active tutor availability.
   */

  const {
    data: availabilityRules,
    error: availabilityError,
  } = await supabaseAdmin
    .from('availability_rules')
    .select('*')
    .eq('active', true)

  if (availabilityError) {
    throw availabilityError
  }

  /*
   * Get active school schedule windows.
   */

  const {
    data: scheduleWindows,
    error: scheduleError,
  } = await supabaseAdmin
    .from('schedule_windows')
    .select('*')
    .eq('active', true)

  if (scheduleError) {
    throw scheduleError
  }

  const windowsById =
    new Map<string, ScheduleWindow>()

  for (const window of
    (scheduleWindows || []) as ScheduleWindow[]) {
    windowsById.set(
      window.id,
      window
    )
  }

  /*
   * Get existing sessions in our generation window.
   */

  const {
    data: existingSessions,
    error: existingError,
  } = await supabaseAdmin
    .from('bookable_sessions')
    .select('*')
    .gte(
      'session_date',
      todayString
    )
    .lte(
      'session_date',
      endDateString
    )

  if (existingError) {
    throw existingError
  }

  const existingByKey =
    new Map<string, ExistingSession>()

  for (const session of
    (existingSessions || []) as ExistingSession[]) {
    const key = makeKey(
      session.availability_rule_id,
      session.session_date,
      session.slot_index
    )

    existingByKey.set(
      key,
      session
    )
  }

  /*
   * Track every session that SHOULD exist.
   */

  const desiredKeys =
    new Set<string>()

  let created = 0
  let updated = 0

  /*
   * Process every tutor availability rule.
   */

  for (const rule of
    (availabilityRules || []) as AvailabilityRule[]) {

    /*
     * Determine duration.
     */

    let duration =
      rule.duration_minutes

    if (rule.session_type === 'lunch') {
      duration = 30
    }

    if (rule.session_type === 'official') {
      duration = 40
    }

    /*
     * We can't generate sessions without
     * a duration.
     */

    if (!duration) {
      continue
    }

    /*
     * School-defined sessions must reference
     * a schedule window.
     */

    let scheduleWindow:
      | ScheduleWindow
      | null = null

    if (
      rule.session_type === 'lunch' ||
      rule.session_type === 'official'
    ) {
      if (!rule.schedule_window_id) {
        continue
      }

      scheduleWindow =
        windowsById.get(
          rule.schedule_window_id
        ) || null

      if (!scheduleWindow) {
        continue
      }

      /*
       * The tutor's selected day must match
       * the school's schedule day.
       */

      if (
        rule.day_of_week !==
        scheduleWindow.day_of_week
      ) {
        continue
      }
    }

    /*
     * Walk through every calendar date in
     * the generation window.
     */

    const currentDate =
      new Date(today)

    currentDate.setHours(
      0,
      0,
      0,
      0
    )

    while (
      currentDate <= endDate
    ) {
      /*
       * Use LOCAL date formatting.
       */

      const dateString =
        formatLocalDate(
          currentDate
        )

      /*
       * Check tutor availability date range.
       */

      if (
        dateString >= rule.start_date &&
        (
          !rule.end_date ||
          dateString <= rule.end_date
        )
      ) {
        /*
         * JavaScript's getDay() returns:
         *
         * Sunday    = 0
         * Monday    = 1
         * Tuesday   = 2
         * Wednesday = 3
         * Thursday  = 4
         * Friday    = 5
         * Saturday  = 6
         */

        const dayOfWeek =
          currentDate.getDay()

        /*
         * Only generate sessions on the
         * tutor's selected day.
         */

        if (
          dayOfWeek ===
          rule.day_of_week
        ) {
          /*
           * For lunch and official sessions,
           * the school schedule is authoritative.
           */

          let startTime =
            rule.start_time

          let endTime =
            rule.end_time

          if (scheduleWindow) {
            /*
             * Make sure the school schedule
             * is active on this date.
             */

            if (
              dateString >=
                scheduleWindow.start_date &&
              dateString <=
                scheduleWindow.end_date
            ) {
              startTime =
                scheduleWindow.start_time

              endTime =
                scheduleWindow.end_time
            } else {
              /*
               * The school schedule isn't active
               * on this date.
               */

              currentDate.setDate(
                currentDate.getDate() + 1
              )

              continue
            }
          }

          /*
           * Generate individual sessions.
           */

          let currentTime =
            startTime

          let slotIndex = 0

          while (true) {
            const nextTime =
              addMinutes(
                currentTime,
                duration
              )

            /*
             * Never create a partial session.
             */

            if (
              nextTime >
              endTime
            ) {
              break
            }

            const key =
              makeKey(
                rule.id,
                dateString,
                slotIndex
              )

            desiredKeys.add(key)

            const existing =
              existingByKey.get(key)

            /*
             * Existing session:
             *
             * Update it rather than replacing it.
             *
             * This preserves bookings when a
             * school schedule changes.
             */

            if (existing) {
              if (
                existing.start_time !==
                  currentTime ||
                existing.end_time !==
                  nextTime ||
                existing.schedule_window_id !==
                  rule.schedule_window_id ||
                existing.session_type !==
                  rule.session_type
              ) {
                const { error } =
                  await supabaseAdmin
                    .from('bookable_sessions')
                    .update({
                      start_time:
                        currentTime,

                      end_time:
                        nextTime,

                      schedule_window_id:
                        rule.schedule_window_id,

                      session_type:
                        rule.session_type,
                    })
                    .eq(
                      'id',
                      existing.id
                    )

                if (error) {
                  throw error
                }

                updated++
              }

              currentTime =
                nextTime

              slotIndex++

              continue
            }

            /*
             * New session.
             */

            const { error } =
              await supabaseAdmin
                .from('bookable_sessions')
                .insert({
                  availability_rule_id:
                    rule.id,

                  schedule_window_id:
                    rule.schedule_window_id,

                  session_type:
                    rule.session_type,

                  session_date:
                    dateString,

                  start_time:
                    currentTime,

                  end_time:
                    nextTime,

                  slot_index:
                    slotIndex,
                })

            if (error) {
              /*
               * Ignore duplicate-key errors.
               */

              if (
                error.code !== '23505'
              ) {
                throw error
              }
            } else {
              created++
            }

            currentTime =
              nextTime

            slotIndex++
          }
        }
      }

      /*
       * Move to the NEXT LOCAL calendar day.
       */

      currentDate.setDate(
        currentDate.getDate() + 1
      )
    }
  }

  /*
   * Remove sessions that should no longer exist.
   *
   * Never delete a session that has a booking.
   */

  const sessionsToRemove =
    (existingSessions || [])
      .filter((session) => {
        const key =
          makeKey(
            session.availability_rule_id,
            session.session_date,
            session.slot_index
          )

        return !desiredKeys.has(key)
      })

  let deleted = 0

  for (const session of
    sessionsToRemove) {

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq(
        'session_id',
        session.id
      )
      .maybeSingle()

    if (bookingError) {
      throw bookingError
    }

    /*
     * Never delete a booked session.
     */

    if (booking) {
      continue
    }

    const { error } =
      await supabaseAdmin
        .from('bookable_sessions')
        .delete()
        .eq(
          'id',
          session.id
        )

    if (error) {
      throw error
    }

    deleted++
  }

  return {
    created,
    updated,
    deleted,
  }
}

/*
 * Add minutes to a HH:MM:SS time.
 */

function addMinutes(
  time: string,
  minutes: number
) {
  const [hours, mins] =
    time
      .split(':')
      .map(Number)

  const total =
    hours * 60 +
    mins +
    minutes

  const newHours =
    Math.floor(
      total / 60
    )

  const newMinutes =
    total % 60

  return (
    `${String(newHours).padStart(2, '0')}:` +
    `${String(newMinutes).padStart(2, '0')}:00`
  )
}

/*
 * Format a JavaScript Date as a LOCAL
 * YYYY-MM-DD date.
 *
 * DO NOT use toISOString() here.
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

/*
 * Create a unique identifier for a session
 * based on its availability rule, date,
 * and position within that day's availability.
 */

function makeKey(
  availabilityRuleId: string,
  date: string,
  slotIndex: number
) {
  return (
    `${availabilityRuleId}|` +
    `${date}|` +
    `${slotIndex}`
  )
}
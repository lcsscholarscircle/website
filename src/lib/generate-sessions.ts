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
  session_type: 'lfp' | 'virtual' | 'library'
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
  session_type: 'lfp' | 'library'
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  duration_minutes: number | null
  active: boolean
}

type ExistingSession = {
  id: string
  availability_rule_id: string
  schedule_window_id: string | null
  session_type: 'lfp' | 'virtual' | 'library'
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

  /*
   * Prevent multiple copies of this generator from
   * running at the same time.
   *
   * pg_advisory_lock is held for the lifetime of the
   * database connection. Since Supabase/PostgREST
   * manages connections for us, use a transaction-scoped
   * advisory lock through a PostgreSQL RPC function.
   *
   * If the lock RPC does not exist yet, create it with:
   *
   * create or replace function public.acquire_session_generator_lock()
   * returns void
   * language plpgsql
   * security definer
   * set search_path = public
   * as $$
   * begin
   *   perform pg_advisory_xact_lock(
   *     hashtextextended('bookable_sessions_generator', 0)
   *   );
   * end;
   * $$;
   *
   * NOTE:
   * Because Supabase REST calls are individually pooled,
   * this RPC lock only protects work performed inside
   * that transaction. The unique constraint plus
   * conflict-safe inserts below remain the final
   * protection against duplicate sessions.
   */

  const {
    error: lockError,
  } = await supabaseAdmin.rpc(
    'acquire_session_generator_lock'
  )

  if (lockError) {
    throw new Error(
      `Failed to acquire session generator lock: ${lockError.message}`
    )
  }

  const today = new Date()

  const todayString =
    formatLocalDate(today)

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

  for (
    const window of
    (scheduleWindows || []) as ScheduleWindow[]
  ) {
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

  for (
    const session of
    (existingSessions || []) as ExistingSession[]
  ) {
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

  for (
    const rule of
    (availabilityRules || []) as AvailabilityRule[]
  ) {
    let duration =
      rule.duration_minutes

    let scheduleWindow:
      | ScheduleWindow
      | null = null

    /*
     * School-defined sessions use the duration
     * and schedule defined by the schedule window.
     */

    if (
      rule.session_type === 'lfp' ||
      rule.session_type === 'library'
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
       * The school schedule window is authoritative
       * for LFP and library session duration.
       */

      duration =
        scheduleWindow.duration_minutes

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
     * We can't generate sessions without
     * a duration.
     */

    if (!duration || duration <= 0) {
      continue
    }

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
           * For LFP and library sessions,
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
                const {
                  error,
                } = await supabaseAdmin
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

                /*
                 * Keep our in-memory copy
                 * synchronized with the database.
                 */

                existing.start_time =
                  currentTime

                existing.end_time =
                  nextTime

                existing.schedule_window_id =
                  rule.schedule_window_id

                existing.session_type =
                  rule.session_type

                updated++
              }

              currentTime =
                nextTime

              slotIndex++

              continue
            }

            /*
             * New session.
             *
             * Use an upsert with ignoreDuplicates.
             *
             * The unique constraint:
             *
             *   availability_rule_id
             *   session_date
             *   slot_index
             *
             * guarantees that concurrent generator
             * executions cannot create duplicate sessions.
             */

            const {
              error,
              data,
            } = await supabaseAdmin
              .from('bookable_sessions')
              .upsert(
                {
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
                },
                {
                  onConflict:
                    'availability_rule_id,session_date,slot_index',

                  ignoreDuplicates:
                    true,

                  count: 'exact',
                }
              )
              .select('id')

            if (error) {
              throw error
            }

            /*
             * When ignoreDuplicates is true,
             * data is empty if another generator
             * already created the row.
             *
             * Only count a session as created
             * when this invocation actually inserted it.
             */

            if (
              data &&
              data.length > 0
            ) {
              created++

              /*
               * Add the newly created session to
               * our in-memory map so subsequent
               * processing sees it as existing.
               */

              existingByKey.set(
                key,
                {
                  id: data[0].id,
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
                }
              )
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

  for (
    const session of
    sessionsToRemove
  ) {
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

    const {
      error,
    } = await supabaseAdmin
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

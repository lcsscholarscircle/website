import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId.' },
        { status: 400 }
      )
    }

    /*
     * Server-side Supabase client.
     *
     * These variables should already exist in Vercel.
     */

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    /*
     * Get the booking and everything needed
     * to construct the email.
     */

    const { data: booking, error: bookingError } =
      await supabase
        .from('bookings')
        .select(`
          id,
          status,
          student_id,
          tutor_id,

          student:profiles!bookings_student_id_fkey (
            id,
            name,
            email
          ),

          tutor:profiles!bookings_tutor_id_fkey (
            id,
            name,
            email
          ),

          bookable_sessions (
            session_date,
            start_time,
            end_time,
            session_type
          )
        `)
        .eq('id', bookingId)
        .single()

    if (bookingError || !booking) {
      console.error('Booking lookup error:', bookingError)

      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      )
    }

    /*
     * Only send a cancellation email for an
     * actually cancelled booking.
     */

    if (booking.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Booking is not cancelled.' },
        { status: 400 }
      )
    }

    const student = booking.student?.[0]
    const tutor = booking.tutor?.[0]
    const session = booking.bookable_sessions?.[0]

    if (!student || !tutor || !session) {
      return NextResponse.json(
        { error: 'Booking is missing related information.' },
        { status: 400 }
      )
    }

    /*
     * Check whether this notification has already
     * been sent. This prevents duplicate emails.
     */

    const { data: existingNotification } =
      await supabase
        .from('notifications')
        .select('id, status')
        .eq('booking_id', bookingId)
        .eq('recipient_id', tutor.id)
        .eq('notification_type', 'booking_cancelled_tutor')
        .maybeSingle()

    if (existingNotification?.status === 'sent') {
      return NextResponse.json({
        success: true,
        alreadySent: true,
      })
    }

    /*
     * Create the notification record if it doesn't
     * already exist.
     */

    let notificationId = existingNotification?.id

    if (!notificationId) {
      const { data: notification, error: notificationError } =
        await supabase
          .from('notifications')
          .insert({
            booking_id: bookingId,
            recipient_id: tutor.id,
            notification_type: 'booking_cancelled_tutor',
            email: tutor.email,
            status: 'pending',
          })
          .select('id')
          .single()

      if (notificationError || !notification) {
        console.error(
          'Notification creation error:',
          notificationError
        )

        return NextResponse.json(
          { error: 'Unable to create notification.' },
          { status: 500 }
        )
      }

      notificationId = notification.id
    }

    /*
     * Connect to Gmail SMTP.
     */

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    /*
     * Format the session information.
     */

    const sessionDate = new Date(
      `${session.session_date}T00:00:00`
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':')

      const date = new Date()

      date.setHours(
        Number(hours),
        Number(minutes),
        0,
        0
      )

      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    }

    const startTime = formatTime(session.start_time)
    const endTime = formatTime(session.end_time)

    /*
     * Send the email.
     */

    await transporter.sendMail({
      from: `"Scholar's Circle" <${process.env.SMTP_USER}>`,
      to: tutor.email,
      subject: 'Your Scholar\'s Circle session was cancelled',
      text: `Hi ${tutor.name},

${student.name} has cancelled their Scholar's Circle tutoring session with you.

Session:
${sessionDate}
${startTime} – ${endTime}

No action is required from you.

- Scholar's Circle`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Scholar's Circle session cancelled</h2>

          <p>Hi ${tutor.name},</p>

          <p>
            <strong>${student.name}</strong> has cancelled
            their Scholar's Circle tutoring session with you.
          </p>

          <p>
            <strong>Session</strong><br>
            ${sessionDate}<br>
            ${startTime} – ${endTime}
          </p>

          <p>No action is required from you.</p>

          <p>
            - Scholar's Circle
          </p>
        </div>
      `,
    })

    /*
     * Mark the notification as successfully sent.
     */

    const { error: updateError } =
      await supabase
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', notificationId)

    if (updateError) {
      console.error(
        'Notification update error:',
        updateError
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Notification error:', error)

    return NextResponse.json(
      {
        error: 'Unable to send notification.',
      },
      {
        status: 500,
      }
    )
  }
}
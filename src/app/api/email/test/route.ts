import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: `"Scholar's Circle" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: "Scholar's Circle SMTP Test",
      text: "This is a test email from Scholar's Circle.",
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('SMTP error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to send email.',
      },
      {
        status: 500,
      }
    )
  }
}
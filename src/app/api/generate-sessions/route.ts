import { NextResponse } from 'next/server'
import { generateSessions } from '@/lib/generate-sessions'

export async function POST() {
  try {
    const result =
      await generateSessions(60)

    return NextResponse.json(result)
  } catch (error) {
    console.error(
      'Session generation failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Failed to generate sessions.',
      },
      {
        status: 500,
      }
    )
  }
}
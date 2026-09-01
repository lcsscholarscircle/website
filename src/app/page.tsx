'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error(error)
        return
      }

      if (profile.role === 'student') {
        window.location.href = '/student'
      } else if (profile.role === 'tutor') {
        window.location.href = '/tutor'
      } else if (profile.role === 'leader') {
        window.location.href = '/admin'
      }
    }

    checkUser()
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      alert(error.message)
    }
  }

  return (
    <main>
      <h1>Scholar's Circle</h1>

      <p>Peer tutoring at Larchmont Charter School.</p>

      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    </main>
  )
}
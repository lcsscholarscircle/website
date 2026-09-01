'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function Home() {
useEffect(() => {
async function checkUser() {
const {
data: { user },
} = await supabase.auth.getUser()

  if (!user) return

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

return ( <main className="flex min-h-screen items-center justify-center px-6"> <div className="w-full max-w-md text-center"> <h1 className="text-3xl font-bold">
Scholar's Circle </h1>

    <p className="mt-2 text-muted-foreground">
      Peer tutoring at Larchmont Charter School.
    </p>

    <Button
      onClick={signInWithGoogle}
      className="mt-6"
    >
      Sign in with Google
    </Button>
  </div>
</main>

)
}


'use client'

import Link from 'next/link'

const board = [
  { name: 'Devon Jasiukonis', role: 'President' },
  { name: 'Everett Mohr', role: 'Vice President' },
  { name: 'Mehrinigor Sodikova', role: 'Director of Operations' },
  { name: 'Mariana Santos', role: 'Internal Director of Communications' },
  { name: 'Rachel Lee', role: 'Media Coordinator' },
  { name: 'Evelyn Choi', role: 'Media Coordinator' },
  { name: 'Zoey Hong', role: 'Media Coordinator' },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">

        {/* Back link */}
        <Link
          href="/"
          className="text-sm text-green-700 dark:text-green-400 hover:text-green-600 transition-colors"
        >
          ← Back to Scholar's Circle
        </Link>

        {/* Hero */}
        <section className="py-16 text-center">
          <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-green-600" />

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Scholar's Circle
          </h1>

          <p className="mt-4 text-lg text-muted-foreground">
            Growing together. Leading together.
          </p>
        </section>

        {/* Mission */}
        <section className="rounded-2xl border border-green-200 dark:border-green-900 bg-card p-8 shadow-sm sm:p-10">
          <h2 className="text-2xl font-semibold text-green-800 dark:text-green-400">
            Our Mission
          </h2>

          <p className="mt-4 leading-7 text-muted-foreground">
            The purpose of the Scholar's Circle organization is to help
            all students (TK-12) grow into creative, innovative leaders
            by providing academic assistance and
            community enrichment opportunities.
          </p>

          <div className="mt-8 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-6 text-center">
            <p className="text-lg italic leading-relaxed text-green-900 dark:text-green-200">
              "Innovation distinguishes between a leader and a follower."
            </p>
            <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
              — Steve Jobs
            </p>
          </div>
        </section>

        {/* Board */}
        <section className="mt-14">
          <div className="text-center">
            <h2 className="text-2xl font-bold">
              Meet the <span className="text-green-700 dark:text-green-400">Board</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The people helping make Scholar's Circle possible.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {board.map((member) => (
              <div
                key={member.name}
                className="rounded-xl border border-green-100 dark:border-green-950 bg-card p-5 transition-all hover:border-green-400 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-950/30"
              >
                <p className="font-semibold">
                  {member.name}
                </p>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  {member.role}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30 p-5 text-center">
            <p className="font-semibold">
              Mr. Joseph Ehrlichmann
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              Faculty Advisor
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-14 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50/60 dark:bg-green-950/30 p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 text-xl">
            ✉
          </div>

          <h2 className="text-2xl font-bold">
            Get in Touch!
          </h2>

          <p className="mt-3 text-muted-foreground">
            Have a question, idea, or want to get involved?
            We'd love to hear from you.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <a
              href="mailto:scholarscircle@larchmontcharter.org"
              className="font-medium text-green-700 dark:text-green-400 underline underline-offset-4 hover:text-green-600 transition-colors"
            >
              scholarscircle@larchmontcharter.org
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-green-200 dark:border-green-900 pt-6 text-center text-sm text-muted-foreground">
          <p>
            Made with <span className="text-green-600">♥</span> by the Scholar's Circle Team
          </p>
          <p className="mt-2">Larchmont Charter School · 2026</p>
          <Link
            href="/"
            className="mt-4 inline-block text-green-700 dark:text-green-400 underline underline-offset-4 hover:text-green-600"
          >
            Return Home
          </Link>
        </footer>

      </div>
    </main>
  )
}

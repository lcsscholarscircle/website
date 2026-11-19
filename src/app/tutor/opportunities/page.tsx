
'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

type Opportunity = {
  id: string
  name: string
  description: string | null
  date: string
  recurring: boolean
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [appliedIds, setAppliedIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setUserId(null)
        setLoading(false)
        return
      }

      setUserId(user.id)

      const [opportunityResult, requestResult] =
        await Promise.all([
          supabase
            .from('opportunities')
            .select('id, name, description, date, recurring')
            .order('date', { ascending: true }),

          supabase
            .from('requests')
            .select('opportunity')
            .eq('requester', user.id)
            .eq('type', 'opportunity_application'),
        ])

      if (opportunityResult.error) {
        throw opportunityResult.error
      }

      if (requestResult.error) {
        throw requestResult.error
      }

      setOpportunities(
        opportunityResult.data || []
      )

      setAppliedIds(
        (requestResult.data || [])
          .map((request) => request.opportunity)
          .filter((id): id is string => id !== null)
      )
    } catch (err) {
      console.error('Failed to load opportunities:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load tutoring opportunities.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function applyForOpportunity(
    opportunity: Opportunity
  ) {
    if (!userId || applyingId) return

    if (appliedIds.includes(opportunity.id)) return

    setApplyingId(opportunity.id)
    setError(null)

    try {
      const { error } = await supabase
        .from('requests')
        .insert({
          requester: userId,
          type: 'opportunity_application',
          opportunity: opportunity.id,
        })

      if (error) {
        throw error
      }

      setAppliedIds((previous) => [
        ...previous,
        opportunity.id,
      ])
    } catch (err) {
      console.error('Failed to submit application:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit your application. Please try again.'
      )
    } finally {
      setApplyingId(null)
    }
  }

  const recurringOpportunities = opportunities.filter(
    (item) => item.recurring
  )

  const oneTimeOpportunities = opportunities.filter(
    (item) => !item.recurring
  )

  if (loading) {
    return (
      <DashboardLayout role="tutor">
        <p className="text-muted-foreground">
          Loading opportunities...
        </p>
      </DashboardLayout>
    )
  }

  if (!userId) {
    return (
      <DashboardLayout role="tutor">
        <p className="text-muted-foreground">
          Please sign in to view tutoring opportunities.
        </p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="tutor">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Tutoring Opportunities
        </h1>

        <p className="mt-2 text-muted-foreground">
          Explore additional ways to get involved with
          Scholar&apos;s Circle. Browse available tutoring
          opportunities and click apply to show your interest.
        </p>
        <p className="mt-2 text-muted-foreground">
          Upon submission of your application, the Scholar&apos;s Circle team will review your standings and reach out to you with more info.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* RECURRING OPPORTUNITIES */}

      <OpportunitySection
        title="Recurring Opportunities"
        description="Ongoing tutoring opportunities that you can apply to participate in."
        opportunities={recurringOpportunities}
        appliedIds={appliedIds}
        applyingId={applyingId}
        onApply={applyForOpportunity}
      />

      {/* ONE-TIME OPPORTUNITIES */}

      <div className="mt-8">
        <OpportunitySection
          title="One-Time Opportunities"
          description="Special events, individual tutoring sessions, and other upcoming opportunities."
          opportunities={oneTimeOpportunities}
          appliedIds={appliedIds}
          applyingId={applyingId}
          onApply={applyForOpportunity}
        />
      </div>
    </DashboardLayout>
  )
}

function OpportunitySection({
  title,
  description,
  opportunities,
  appliedIds,
  applyingId,
  onApply,
}: {
  title: string
  description: string
  opportunities: Opportunity[]
  appliedIds: string[]
  applyingId: string | null
  onApply: (opportunity: Opportunity) => void
}) {
  return (
    <section className="rounded-xl border bg-indigo-50">
      <div className="border-b p-5">
        <h2 className="font-semibold">
          {title}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      {opportunities.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No opportunities are currently available.
        </p>
      ) : (
        <div className="space-y-4 p-5">
          {opportunities.map((opportunity) => {
            const applied = appliedIds.includes(
              opportunity.id
            )

            const applying =
              applyingId === opportunity.id

            return (
              <div
                key={opportunity.id}
                className="rounded-xl border p-5 sm:p-6 bg-indigo-100"
              >
                <div className="flex flex-col gap-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold break-words">
                      {opportunity.name}
                    </h3>

                    {!opportunity.recurring && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(
                          `${opportunity.date}T00:00:00`
                        ).toLocaleDateString([], {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}

                    {opportunity.description && (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground whitespace-pre-wrap break-words">
                        {opportunity.description}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end border-t pt-4">
                    <Button
                      className="bg-indigo-500"
                      variant={applied ? 'outline' : 'default'}
                      disabled={
                        applied ||
                        applying ||
                        applyingId !== null
                      }
                      onClick={() => onApply(opportunity)}
                    >
                      {applying
                        ? 'Submitting...'
                        : applied
                          ? 'Application Submitted'
                          : 'Apply'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

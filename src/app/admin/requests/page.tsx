
'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

type RequestRecord = {
  id: string
  created_at: string
  requester: string
  type: string | null
  opportunity: string | null
  information: string | null
  subjects: string[] | null
  requester_profile: {
    id: string
    name: string | null
    email: string | null
    grade: number | null
    role: string | null
  } | null
  opportunity_details: {
    id: string
    name: string
    date: string
    recurring: boolean
  } | null
}

type SubjectRecord = {
  id: string
  name: string
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadRequests() {
    setLoading(true)
    setError(null)

    try {
      // Load requests and their related profiles/opportunities.

      const { data, error: requestsError } = await supabase
        .from('requests')
        .select(`
          id,
          created_at,
          requester,
          type,
          opportunity,
          information,
          subjects,

          requester_profile:profiles!requests_requester_fkey (
            id,
            name,
            email,
            grade,
            role
          ),

          opportunity_details:opportunities!requests_opportunity_fkey (
            id,
            name,
            date,
            recurring
          )
        `)
        .order('created_at', { ascending: false })

      if (requestsError) {
        throw requestsError
      }

      setRequests((data || []) as unknown as RequestRecord[])

      // Load subjects and create an ID-to-name lookup.

      const { data: subjectData, error: subjectError } =
        await supabase
          .from('subjects')
          .select('id, name')

      if (subjectError) {
        throw subjectError
      }

      const subjectMap: Record<string, string> = {}

      ;((subjectData || []) as SubjectRecord[]).forEach((subject) => {
        subjectMap[subject.id] = subject.name
      })

      setSubjectNames(subjectMap)

    } catch (err) {
      console.error('Failed to load requests:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load requests.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const tutorApplications = requests.filter(
    (request) => request.type === 'tutor_application'
  )

  const pairingRequests = requests.filter(
    (request) => request.type === 'pairing_request'
  )

  const opportunityApplications = requests.filter(
    (request) => request.type === 'opportunity_application'
  )

  const otherRequests = requests.filter(
    (request) =>
      ![
        'tutor_application',
        'pairing_request',
        'opportunity_application',
      ].includes(request.type || '')
  )

  if (loading) {
    return (
      <DashboardLayout role="leader">
        <p className="text-muted-foreground">
          Loading requests...
        </p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="leader">

      {/* HEADER */}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Requests
          </h1>

          <p className="mt-2 text-muted-foreground">
            Review applications and requests submitted by students
            and tutors.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadRequests}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Tutor Applications"
          count={tutorApplications.length}
        />

        <SummaryCard
          title="Pairing Requests"
          count={pairingRequests.length}
        />

        <SummaryCard
          title="Opportunity Applications"
          count={opportunityApplications.length}
        />
      </div>

      {/* TUTOR APPLICATIONS */}

      <RequestSection
        title="Tutor Applications"
        description="Applications submitted by prospective tutors."
        requests={tutorApplications}
        subjectNames={subjectNames}
      />

      {/* PAIRING REQUESTS */}

      <div className="mt-8">
        <RequestSection
          title="Pairing Requests"
          description="Requests submitted by students seeking tutoring arrangements."
          requests={pairingRequests}
          subjectNames={subjectNames}
        />
      </div>

      {/* OPPORTUNITY APPLICATIONS */}

      <div className="mt-8">
        <RequestSection
          title="Special Opportunity Applications"
          description="Tutors applying to participate in special tutoring opportunities."
          requests={opportunityApplications}
          subjectNames={subjectNames}
        />
      </div>

      {/* OTHER REQUEST TYPES */}

      {otherRequests.length > 0 && (
        <div className="mt-8">
          <RequestSection
            title="Other Requests"
            description="Requests that do not match the currently categorized request types."
            requests={otherRequests}
            subjectNames={subjectNames}
          />
        </div>
      )}

    </DashboardLayout>
  )
}

/* SUMMARY CARD */

function SummaryCard({
  title,
  count,
}: {
  title: string
  count: number
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
      <p className="text-sm text-muted-foreground">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-blue-900">
        {count}
      </p>
    </div>
  )
}

/* REQUEST SECTION */

function RequestSection({
  title,
  description,
  requests,
  subjectNames,
}: {
  title: string
  description: string
  requests: RequestRecord[]
  subjectNames: Record<string, string>
}) {
  return (
    <section className="rounded-xl border bg-white">

      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No requests have been submitted.
        </p>
      ) : (
        <div className="divide-y">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              subjectNames={subjectNames}
            />
          ))}
        </div>
      )}

    </section>
  )
}

/* INDIVIDUAL REQUEST */

function RequestCard({
  request,
  subjectNames,
}: {
  request: RequestRecord
  subjectNames: Record<string, string>
}) {
  const profile = request.requester_profile
  const opportunity = request.opportunity_details

  // Translate the selected subject IDs into readable names.

  const requestedSubjects = (request.subjects || []).map(
    (id) => subjectNames[id] || 'Unknown subject'
  )

  return (
    <div className="space-y-4 p-5 sm:p-6">

      {/* REQUESTER INFORMATION */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold">
            {profile?.name || 'Unknown User'}
          </h3>

          <div className="mt-1 space-y-1 text-sm text-muted-foreground">

            {profile?.email && (
              <p className="break-all">
                {profile.email}
              </p>
            )}

            <p>
              {profile?.role
                ? profile.role.charAt(0).toUpperCase() +
                  profile.role.slice(1)
                : 'Unknown role'}

              {profile?.grade !== null &&
                profile?.grade !== undefined &&
                ` · Grade ${profile.grade}`}
            </p>

          </div>
        </div>

        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(request.created_at).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>

      </div>

      {/* TUTOR APPLICATION SUBJECTS */}

      {request.type === 'tutor_application' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">

          <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            Subjects Available to Tutor
          </p>

          {requestedSubjects.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">

              {requestedSubjects.map((subject, index) => (
                <span
                  key={`${subject}-${index}`}
                  className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-800"
                >
                  {subject}
                </span>
              ))}

            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No subjects selected.
            </p>
          )}

        </div>
      )}

      {/* OPPORTUNITY INFORMATION */}

      {opportunity && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">

          <p className="text-xs font-medium uppercase tracking-wide text-blue-900">
            Opportunity
          </p>

          <p className="mt-1 font-medium">
            {opportunity.name}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {opportunity.recurring
              ? 'Recurring opportunity'
              : new Date(
                  `${opportunity.date}T00:00:00`
                ).toLocaleDateString([], {
                  dateStyle: 'long',
                })}
          </p>

        </div>
      )}

      {/* APPLICATION INFORMATION */}

      {request.information && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-900">
            {request.type === 'tutor_application'
              ? 'Application Answers'
              : 'Additional Information'}
          </p>

          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {request.information}
          </p>

        </div>
      )}

      {!request.information && (
        <p className="text-sm italic text-muted-foreground">
          No additional information provided.
        </p>
      )}

    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

type Profile = {
  id: string
  name: string
  email: string
  grade: number | null
  role: string
  subjects: string[]
}

type Subject = {
  id: string
  name: string
}

export default function TutorsPage() {
  const [students, setStudents] = useState<Profile[]>([])
  const [tutors, setTutors] = useState<Profile[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [selectedStudent, setSelectedStudent] =
    useState<Profile | null>(null)

  const [selectedSubjects, setSelectedSubjects] =
    useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState(false)

  async function loadData() {
    const { data: profiles, error: profileError } =
      await supabase
        .from('profiles')
        .select('id, name, email, grade, role, subjects')
        .order('name')

    const { data: subjectData, error: subjectError } =
      await supabase
        .from('subjects')
        .select('id, name')
        .order('name')

    if (profileError) {
      console.error(profileError)
    }

    if (subjectError) {
      console.error(subjectError)
    }

    if (profiles) {
      setStudents(
        profiles.filter((profile) => profile.role === 'student')
      )

      setTutors(
        profiles.filter((profile) => profile.role === 'tutor')
      )
    }

    if (subjectData) {
      setSubjects(subjectData)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openPromotionDialog(student: Profile) {
    setSelectedStudent(student)
    setSelectedSubjects([])
  }

  function closePromotionDialog() {
    if (promoting) return

    setSelectedStudent(null)
    setSelectedSubjects([])
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjects((current) => {
      if (current.includes(subjectId)) {
        return current.filter((id) => id !== subjectId)
      }

      return [...current, subjectId]
    })
  }

  async function promoteStudent() {
    if (!selectedStudent) return

    if (selectedSubjects.length === 0) {
      alert('Please select at least one subject.')
      return
    }

    setPromoting(true)

    const { error } = await supabase.rpc('promote_to_tutor', {
      target_user_id: selectedStudent.id,
      tutor_subjects: selectedSubjects,
    })

    if (error) {
      alert(error.message)
      setPromoting(false)
      return
    }

    setPromoting(false)
    closePromotionDialog()

    await loadData()
  }

  if (loading) {
    return (
      <DashboardLayout role="leader">
        <p>Loading...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="leader">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Tutors
        </h1>

        <p className="mt-1 text-muted-foreground">
          Manage Scholar&apos;s Circle tutors.
        </p>
      </div>

      {/* CURRENT TUTORS */}

      <section className="rounded-xl border bg-white">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">
            Current Tutors
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Students currently approved to tutor.
          </p>
        </div>

        {tutors.length === 0 ? (
          <p className="p-6 text-muted-foreground">
            No tutors yet.
          </p>
        ) : (
          <div className="divide-y">
            {tutors.map((tutor) => (
              <div
                key={tutor.id}
                className="flex items-center justify-between p-6"
              >
                <div>
                  <p className="font-medium">
                    {tutor.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {tutor.email}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {tutor.subjects?.map((subjectId) => {
                      const subject = subjects.find(
                        (item) => item.id === subjectId
                      )

                      if (!subject) return null

                      return (
                        <Badge
                          key={subject.id}
                          variant="secondary"
                        >
                          {subject.name}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <Badge>Tutor</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* STUDENTS */}

      <section className="mt-8 rounded-xl border bg-white">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">
            Students
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Promote students to become tutors.
          </p>
        </div>

        {students.length === 0 ? (
          <p className="p-6 text-muted-foreground">
            No students available.
          </p>
        ) : (
          <div className="divide-y">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-6"
              >
                <div>
                  <p className="font-medium">
                    {student.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {student.email}
                  </p>
                </div>

                <Button
                  onClick={() =>
                    openPromotionDialog(student)
                  }
                >
                  Promote to Tutor
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PROMOTION DIALOG */}

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            closePromotionDialog()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Promote {selectedStudent?.name} to Tutor
            </DialogTitle>

            <DialogDescription>
              Select the subjects this student is qualified
              to tutor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {subjects.map((subject) => (
              <label
                key={subject.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedSubjects.includes(subject.id)}
                  onCheckedChange={() =>
                    toggleSubject(subject.id)
                  }
                />

                <span className="text-sm font-medium">
                  {subject.name}
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePromotionDialog}
              disabled={promoting}
            >
              Cancel
            </Button>

            <Button
              onClick={promoteStudent}
              disabled={
                promoting || selectedSubjects.length === 0
              }
            >
              {promoting ? 'Promoting...' : 'Promote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { ProtectedRoute } from '#/components/auth/ProtectedRoute'
import { useUserRole } from '#/lib/hooks/useUserRole'
import {
  useMyApplication,
  useSubmitApplication,
} from '#/lib/hooks/useApplications'
import type { SubmitApplicationInput } from '#/lib/types'

export const Route = createFileRoute('/apply-author')({
  component: ApplyAuthorPage,
})

function ApplyAuthorPage() {
  return (
    <ProtectedRoute>
      <ApplyAuthorContent />
    </ProtectedRoute>
  )
}

function ApplyAuthorContent() {
  const { isUser, isLoaded } = useUserRole()
  const navigate = useNavigate()
  const { data: application, isLoading: appLoading } = useMyApplication()
  const submitApplication = useSubmitApplication()

  useEffect(() => {
    if (isLoaded && !isUser) {
      navigate({ to: '/' })
    }
  }, [isLoaded, isUser, navigate])

  const form = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      bio: '',
      experience: '',
    },
    onSubmit: async ({ value }) => {
      await submitApplication.mutateAsync(value as SubmitApplicationInput)
    },
  })

  if (!isLoaded || appLoading) {
    return (
      <div className="py-12 text-center text-(--sea-ink-soft)">
        Loading...
      </div>
    )
  }

  if (!isUser) return null

  if (application) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-(--sea-ink)">
          Author Application
        </h1>
        <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-(--sea-ink-soft)">
                Status:{' '}
              </span>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${
                  application.Status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : application.Status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {application.Status}
              </span>
            </div>
            <p className="text-sm text-(--sea-ink-soft)">
              Submitted on{' '}
              {new Date(application.SubmittedAt).toLocaleDateString()}
            </p>
            {application.ReviewNotes && (
              <div>
                <span className="text-sm font-medium text-(--sea-ink-soft)">
                  Review notes:{' '}
                </span>
                <p className="text-sm text-(--sea-ink)">
                  {application.ReviewNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-(--sea-ink)">
        Apply to be an Author
      </h1>
      <p className="mb-6 text-(--sea-ink-soft)">
        Authors can create, edit, and delete their own events. Fill out the form
        below and an admin will review your application.
      </p>
      <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="full_name"
            validators={{
              onChange: ({ value }) =>
                !value ? 'Full name is required' : undefined,
            }}
          >
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) =>
                !value ? 'Email is required' : undefined,
            }}
          >
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Email *
                </label>
                <input
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="bio">
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Bio (optional)
                </label>
                <textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="experience"
            validators={{
              onChange: ({ value }) =>
                !value ? 'Experience is required' : undefined,
            }}
          >
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Relevant Experience *
                </label>
                <p className='text-xs text-(--sea-ink-soft)'>(Venue/work/event affiliation will suffice)</p>
                <textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  rows={3}
                  placeholder="Tell us about your experience with local events..."
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {submitApplication.isError && (
            <p className="text-sm text-red-600">
              Failed to submit application. Please try again.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitApplication.isPending}
              className="rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
            >
              {submitApplication.isPending
                ? 'Submitting...'
                : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

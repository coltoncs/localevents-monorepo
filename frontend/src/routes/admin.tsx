import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import {
  usePendingApplications,
  useApproveApplication,
  useRejectApplication,
} from '#/lib/hooks/useApplications'
import type { AuthorApplication } from '#/lib/types'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

function AdminPage() {
  return (
    <RoleProtectedRoute roles={['admin']}>
      <AdminContent />
    </RoleProtectedRoute>
  )
}

function ApplicationCard({ app }: { app: AuthorApplication }) {
  const approve = useApproveApplication()
  const reject = useRejectApplication()
  const [reviewNotes, setReviewNotes] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-[var(--sea-ink)]">{app.FullName}</h3>
          <p className="text-sm text-[var(--sea-ink-soft)]">{app.Email}</p>
        </div>
        <span className="text-xs text-[var(--sea-ink-soft)]">
          {new Date(app.SubmittedAt).toLocaleDateString()}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-medium text-[var(--sea-ink-soft)]">Bio</h4>
        <p className="text-sm text-[var(--sea-ink)]">{app.Bio}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-[var(--sea-ink-soft)]">Experience</h4>
        <p className="text-sm text-[var(--sea-ink)]">{app.Experience}</p>
      </div>

      {showReject && (
        <div>
          <label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
            Review Notes (optional)
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            approve.mutate({ id: app.ID, review_notes: reviewNotes })
          }
          disabled={approve.isPending}
          className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {approve.isPending ? 'Approving...' : 'Approve'}
        </button>
        {!showReject ? (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              reject.mutate({ id: app.ID, review_notes: reviewNotes })
            }
            disabled={reject.isPending}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        )}
      </div>
    </div>
  )
}

function AdminContent() {
  const { data: applications, isLoading } = usePendingApplications()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--sea-ink)]">
        Admin - Pending Applications
      </h1>

      {isLoading && (
        <div className="py-12 text-center text-[var(--sea-ink-soft)]">
          Loading...
        </div>
      )}

      {applications && applications.length === 0 && (
        <p className="py-12 text-center text-[var(--sea-ink-soft)]">
          No pending applications.
        </p>
      )}

      <div className="space-y-4">
        {applications?.map((app) => (
          <ApplicationCard key={app.ID} app={app} />
        ))}
      </div>
    </div>
  )
}

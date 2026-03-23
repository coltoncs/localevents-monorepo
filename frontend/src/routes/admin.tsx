import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import {
  usePendingApplications,
  useApproveApplication,
  useRejectApplication,
} from '#/lib/hooks/useApplications'
import type { AuthorApplication } from '#/lib/types'
import { Spinner } from '#/components/Spinner'
import { apiClient } from '#/lib/api'

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
    <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-(--sea-ink)">{app.FullName}</h3>
          <p className="text-sm text-(--sea-ink-soft)">{app.Email}</p>
        </div>
        <span className="text-xs text-(--sea-ink-soft)">
          {new Date(app.SubmittedAt).toLocaleDateString()}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-medium text-(--sea-ink-soft)">Bio</h4>
        <p className="text-sm text-(--sea-ink)">{app.Bio}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-(--sea-ink-soft)">Experience</h4>
        <p className="text-sm text-(--sea-ink)">{app.Experience}</p>
      </div>

      {showReject && (
        <div>
          <label className="block text-sm font-medium text-(--sea-ink-soft)">
            Review Notes (optional)
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
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
          className="cursor-pointer rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {approve.isPending ? 'Approving...' : 'Approve'}
        </button>
        {!showReject ? (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="cursor-pointer rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
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
            className="cursor-pointer rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        )}
      </div>
    </div>
  )
}

function DigestTrigger() {
  const trigger = useMutation({
    mutationFn: () =>
      apiClient<{ status: string }>('/api/admin/digest/trigger', {
        method: 'POST',
      }),
  })

  return (
    <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-(--sea-ink)">Weekly Digest</h3>
          <p className="text-sm text-(--sea-ink-soft)">
            Send the weekly event digest to all subscribed users now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
          className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon) disabled:opacity-50"
        >
          {trigger.isPending ? 'Sending...' : 'Send Digest'}
        </button>
      </div>
      {trigger.isSuccess && (
        <p className="mt-2 text-sm text-green-600">Digest triggered successfully. Check server logs for details.</p>
      )}
      {trigger.isError && (
        <p className="mt-2 text-sm text-red-600">Failed to trigger digest.</p>
      )}
    </div>
  )
}

function AdminContent() {
  const { data: applications, isLoading } = usePendingApplications()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-(--sea-ink)">Admin</h1>

      <DigestTrigger />

      <h2 className="mt-8 mb-4 text-xl font-bold text-(--sea-ink)">
        Pending Applications
      </h2>

      {isLoading && (
        <Spinner className="py-12" />
      )}

      {applications && applications.length === 0 && (
        <p className="py-12 text-center text-(--sea-ink-soft)">
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

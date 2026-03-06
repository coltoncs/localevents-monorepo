import { createFileRoute } from '@tanstack/react-router'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import { EventForm } from '#/components/EventForm'

export const Route = createFileRoute('/submit')({
  component: SubmitPage,
})

function SubmitPage() {
  return (
    <RoleProtectedRoute roles={['author', 'admin']}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-[var(--sea-ink)]">
          Submit an Event
        </h1>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <EventForm />
        </div>
      </div>
    </RoleProtectedRoute>
  )
}

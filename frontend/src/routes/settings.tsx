import { createFileRoute, Link } from '@tanstack/react-router'
import { ProtectedRoute } from '#/components/ProtectedRoute'
import { SettingsForm } from '#/components/SettingsForm'
import { NotificationSettings } from '#/components/NotificationSettings'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-[var(--sea-ink)]">Settings</h1>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <SettingsForm />
        </div>
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <h2 className="mb-3 text-lg font-semibold text-[var(--sea-ink)]">Notifications</h2>
          <NotificationSettings />
        </div>
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <h2 className="text-lg font-semibold text-[var(--sea-ink)]">Subscription</h2>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Support 919Events with a small monthly donation.
          </p>
          <Link
            to="/donate"
            className="mt-3 inline-block rounded-md bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white! no-underline hover:bg-[var(--lagoon)]"
          >
            Manage subscription
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  )
}

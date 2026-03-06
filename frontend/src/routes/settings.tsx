import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/components/ProtectedRoute'
import { SettingsForm } from '#/components/SettingsForm'

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
      </div>
    </ProtectedRoute>
  )
}

import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '#/lib/hooks/useNotifications'
import { useUser } from '#/lib/hooks/useUser'
import { CATEGORIES } from '#/components/EventFilters'

export function NotificationSettings() {
  const { data: prefs, isLoading } = useNotificationPreferences()
  const { data: user } = useUser()
  const updatePrefs = useUpdateNotificationPreferences()

  const [emailEnabled, setEmailEnabled] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [preferredCategories, setPreferredCategories] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.email_enabled)
      setSmsEnabled(prefs.sms_enabled)
      setPhoneNumber(prefs.phone_number ?? '')
      setPreferredCategories(prefs.preferred_categories ?? [])
    }
  }, [prefs])

  const hasLocation = !!(user?.DefaultLatitude && user?.DefaultLongitude)
  const hasEmail = !!user?.Email
  const hasSubscription = prefs?.has_subscription ?? false

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if ((emailEnabled || smsEnabled) && !hasLocation) {
      setError('Please set a default location in your settings above before enabling notifications.')
      return
    }
    if (emailEnabled && !hasEmail) {
      setError('An email address is required to enable email notifications.')
      return
    }
    if (smsEnabled && !phoneNumber) {
      setError('A phone number is required to enable SMS notifications.')
      return
    }
    if (smsEnabled && phoneNumber && !/^\+1\d{10}$/.test(phoneNumber)) {
      setError('Phone number must be in format +1XXXXXXXXXX')
      return
    }

    updatePrefs.mutate({
      email_enabled: emailEnabled,
      sms_enabled: smsEnabled,
      phone_number: phoneNumber || undefined,
      preferred_categories: preferredCategories,
    })
  }

  if (isLoading) {
    return <p className="text-sm text-(--sea-ink-soft)">Loading...</p>
  }

  console.log('prefs settings: ', prefs);
  console.log('user: ', user);
  

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-(--sea-ink-soft)">
        Get a weekly digest of events near you every Friday morning.
      </p>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
        />
        <span className="text-sm text-(--sea-ink)">Email digest</span>
        {hasEmail && (
          <span className="text-xs text-(--sea-ink-soft)">({user?.Email})</span>
        )}
      </label>

      <div className="flex items-center gap-3">
        <label className={`flex items-center gap-3${!hasSubscription ? ' pointer-events-none' : ''}`}>
          <input
            type="checkbox"
            checked={smsEnabled && hasSubscription}
            onChange={(e) => {
              if (hasSubscription) setSmsEnabled(e.target.checked)
            }}
            disabled={!hasSubscription}
            className="h-4 w-4 rounded border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon) disabled:opacity-50"
          />
          <span className={`text-sm ${hasSubscription ? 'text-(--sea-ink)' : 'text-(--sea-ink-soft)'}`}>
            SMS digest
          </span>
        </label>
        {!hasSubscription && (
          <Link
            to="/donate"
            className="text-xs font-medium text-(--lagoon-deep) no-underline hover:text-(--lagoon)"
          >
            Subscriber perk — subscribe to unlock
          </Link>
        )}
      </div>

      {smsEnabled && hasSubscription && (
        <div>
          <label className="block text-sm font-medium text-(--sea-ink-soft)">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1XXXXXXXXXX"
            className="mt-1 block w-full rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon) focus:outline-none"
          />
        </div>
      )}

      {(emailEnabled || smsEnabled) && (
        <div>
          <label className="block text-sm font-medium text-(--sea-ink-soft) mb-2">
            Preferred Categories (up to 3)
          </label>
          <p className="text-xs text-(--sea-ink-soft) mb-2">
            Events in these categories will appear first in your digest.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = preferredCategories.includes(c)
              const atMax = preferredCategories.length >= 3 && !selected
              return (
                <button
                  key={c}
                  type="button"
                  disabled={atMax}
                  onClick={() => {
                    if (selected) {
                      setPreferredCategories(preferredCategories.filter((cat) => cat !== c))
                    } else {
                      setPreferredCategories([...preferredCategories, c])
                    }
                  }}
                  className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium border ${
                    selected
                      ? 'bg-[rgba(79,184,178,0.14)] border-(--lagoon-deep) text-(--lagoon-deep)'
                      : 'border-(--line) text-(--sea-ink-soft) hover:bg-(--surface)'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!hasLocation && (emailEnabled || smsEnabled) && (
        <p className="text-sm text-amber-600">
          Set a default location above to receive notifications.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {updatePrefs.isSuccess && <p className="text-sm text-green-600">Notification preferences saved.</p>}
      {updatePrefs.isError && <p className="text-sm text-red-600">Failed to save preferences.</p>}

      <button
        type="submit"
        disabled={updatePrefs.isPending}
        className="rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
      >
        {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
      </button>
    </form>
  )
}

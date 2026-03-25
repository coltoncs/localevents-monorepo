import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy | 919Events' },
      { name: 'description', content: 'Privacy policy for 919Events — how we collect, use, and protect your data.' },
      { property: 'og:title', content: 'Privacy Policy | 919Events' },
      { property: 'og:description', content: 'Privacy policy for 919Events.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/privacy' },
    ],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <h1 className="display-title mb-6 text-3xl font-bold text-(--sea-ink)">
          Privacy Policy
        </h1>
        <p className="mb-4 text-sm text-(--sea-ink-soft)">
          Last updated: March 23, 2026
        </p>

        <div className="space-y-6 text-(--sea-ink-soft) leading-7">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">What We Collect</h2>
            <p>
              When you create an account on 919Events, we store the following information
              provided through your Clerk account:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Email address</li>
              <li>Username</li>
              <li>Default location (latitude, longitude, and search radius) that you set in your settings</li>
              <li>Phone number, if you choose to enable SMS notifications</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">How We Use Your Data</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Email address:</strong> Used to send you weekly event digest emails if you opt in
              </li>
              <li>
                <strong>Phone number:</strong> Used to send you weekly event digest SMS messages if you opt in.
                This is a subscriber-only feature.
              </li>
              <li>
                <strong>Location:</strong> Used to find events near you and personalize your digest
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">Opting Out</h2>
            <p>
              You can disable email or SMS notifications at any time from your{' '}
              <a href="/settings" className="text-(--lagoon-deep) hover:text-(--lagoon)">Settings</a> page.
              Email digests include a one-click unsubscribe link in every message. For SMS, you
              can reply STOP to any message to unsubscribe immediately.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">Data Sharing</h2>
            <p>
              We do not sell, rent, or share your personal data with third parties. We use the
              following services to operate the platform:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Clerk</strong> for authentication and account management</li>
              <li><strong>Resend</strong> for sending email digests</li>
              <li><strong>Twilio</strong> for sending SMS digests</li>
            </ul>
            <p className="mt-2">
              These services only receive the minimum data necessary to perform their function
              (e.g., your email address to send an email, your phone number to send a text).
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">Data Retention</h2>
            <p>
              Your data is retained as long as you have an active account. If you delete your
              account through Clerk, all associated data (preferences, notification logs, saved
              events) is permanently removed.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-(--sea-ink)">Contact</h2>
            <p>
              If you have questions about this policy, you can reach us at{' '}
              <a href="mailto:colton.sweeney@gmail.com" className="text-(--lagoon-deep) hover:text-(--lagoon)">
                colton.sweeney@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

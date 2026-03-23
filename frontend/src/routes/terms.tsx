import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms of Service | 919Events' },
      { name: 'description', content: 'Terms of service for 919Events.' },
      { property: 'og:title', content: 'Terms of Service | 919Events' },
      { property: 'og:description', content: 'Terms of service for 919Events.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/terms' },
    ],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <h1 className="display-title mb-6 text-3xl font-bold text-[var(--sea-ink)]">
          Terms of Service
        </h1>
        <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
          Last updated: March 23, 2026
        </p>

        <div className="space-y-6 text-[var(--sea-ink-soft)] leading-7">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Overview</h2>
            <p>
              919Events is a free community platform that aggregates local events in your area.
              By using the site, you agree to the following terms.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Accounts</h2>
            <p>
              You may create an account to save events, submit events, and manage notification
              preferences. You are responsible for maintaining the security of your account.
              Accounts are managed through Clerk.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">User-Submitted Content</h2>
            <p>
              If you submit events to 919Events, you represent that the information is accurate
              to the best of your knowledge. We reserve the right to remove any content that is
              misleading, inappropriate, or violates these terms.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Notifications</h2>
            <p>
              By enabling email or SMS notifications, you consent to receive weekly event digest
              messages from 919Events. You can opt out at any time:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Email: Click the unsubscribe link in any digest email, or disable in Settings</li>
              <li>SMS: Reply STOP to any message, or disable in Settings</li>
            </ul>
            <p className="mt-2">
              SMS notifications are available to subscribers ($2/month). Standard message and data
              rates may apply. Message frequency is approximately once per week.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Subscriptions</h2>
            <p>
              Monthly subscriptions are processed through Clerk. You may cancel at any time from
              the{' '}
              <a href="/donate" className="text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]">Donate</a>{' '}
              page. Cancellation takes effect at the end of the current billing period.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Event Data</h2>
            <p>
              Event information is aggregated from public sources and user submissions. We make
              no guarantees about the accuracy, completeness, or availability of any event listing.
              Always verify details with the event organizer.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Limitation of Liability</h2>
            <p>
              919Events is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for
              any damages arising from your use of the platform, including but not limited to
              inaccurate event information or service interruptions.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Changes</h2>
            <p>
              We may update these terms from time to time. Continued use of 919Events after
              changes constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Contact</h2>
            <p>
              Questions about these terms can be sent to{' '}
              <a href="mailto:colton.sweeney@gmail.com" className="text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]">
                colton.sweeney@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

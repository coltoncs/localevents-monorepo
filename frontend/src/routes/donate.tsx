import { createFileRoute } from '@tanstack/react-router'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { PricingTable } from '@clerk/clerk-react'

export const Route = createFileRoute('/donate')({
  head: () => ({
    meta: [
      { title: 'Donate | 919Events' },
      { name: 'description', content: 'Support 919Events with a small monthly donation to help us keep the platform free and open for everyone.' },
      { property: 'og:title', content: 'Donate | 919Events' },
      { property: 'og:description', content: 'Support 919Events with a small monthly donation.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/donate' },
    ],
  }),
  component: DonatePage,
})

function DonatePage() {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Support Us</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Help keep 919Events free.
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)]">
          919Events is free for everyone and always will be. If you'd like to
          support the project, a small monthly donation helps us cover hosting
          and keep building new features.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* CashApp section */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
            <h2 className="text-lg font-semibold text-[var(--sea-ink)]">
              One-time via Cash App
            </h2>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Send a one-time donation of any amount.
            </p>
            <p className="mt-4 text-2xl font-bold text-[var(--lagoon-deep)]">
              $coltoncs
            </p>
          </div>

          {/* Subscription section */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
            <h2 className="text-center text-lg font-semibold text-[var(--sea-ink)]">
              Monthly via subscription
            </h2>
            <p className="mt-1 text-center text-sm text-[var(--sea-ink-soft)]">
              Set up a recurring $1/month donation to support ongoing development.
            </p>
            <div className="mt-4">
              {isSignedIn ? (
                <PricingTable />
              ) : (
                <div className="mt-2 text-center">
                  <button
                    onClick={() => openSignIn()}
                    className="cursor-pointer rounded-md bg-[var(--lagoon-deep)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--lagoon)]"
                  >
                    Sign in to subscribe
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

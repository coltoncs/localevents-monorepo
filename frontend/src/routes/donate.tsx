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
          Help keep events free.
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)]">
          919Events is free for everyone and always will be. If you'd like to
          support the project, a small monthly donation helps us cover hosting
          and keep building new features.
        </p>

        <div className="mt-8">
          {isSignedIn ? (
            <PricingTable />
          ) : (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
              <p className="text-[var(--sea-ink-soft)]">
                Sign in to manage your subscription.
              </p>
              <button
                onClick={() => openSignIn()}
                className="mt-4 cursor-pointer rounded-md bg-[var(--lagoon-deep)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--lagoon)]"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

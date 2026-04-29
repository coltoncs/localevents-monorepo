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
        <h1 className="display-title mb-3 text-4xl font-bold text-(--sea-ink) sm:text-5xl">
          Help keep 919Events free.
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-8 text-(--sea-ink-soft)">
          919Events is free for everyone and always will be. If you'd like to
          support the project, a small monthly donation helps us cover hosting
          and keep building new features.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8">
          {/* Subscription section */}
          <div className="rounded-lg border border-(--line) bg-(--surface) p-6">
            <h2 className="text-center text-lg font-semibold text-(--sea-ink)">
              Monthly via subscription
            </h2>
            <p className="mt-1 text-center text-sm text-(--sea-ink-soft)">
              Set up a recurring $2/month donation to support ongoing development.
              Subscribers get acess to on-demand e-mail digests. Cancel anytime!
            </p>
            <div className="mt-4">
              {isSignedIn ? (
                <PricingTable
                  checkoutProps={{
                    appearance: {
                      elements: {
                        drawerRoot: { zIndex: 100 },
                      },
                    },
                  }}
                />
              ) : (
                <div className="mt-2 text-center">
                  <button
                    onClick={() => openSignIn()}
                    className="cursor-pointer rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
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

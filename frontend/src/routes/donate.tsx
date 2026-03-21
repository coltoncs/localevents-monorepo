import { useState } from 'react'
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
  const [qrOpen, setQrOpen] = useState(false)

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

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Zelle section */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
            <h2 className="text-lg font-semibold text-[var(--sea-ink)]">
              One-time via Zelle
            </h2>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Scan this QR code in your bank's app to send a one-time donation.
            </p>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="mx-auto mt-4 block cursor-pointer rounded-lg border-0 bg-transparent p-0"
            >
              <img
                src="/zelle-qr.jpg"
                alt="Zelle QR code to donate — click to enlarge"
                className="w-56 rounded-lg transition hover:opacity-80"
              />
            </button>
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

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/zelle-qr.jpg"
              alt="Zelle QR code to donate"
              className="max-h-[85vh] rounded-xl"
            />
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-lg hover:bg-[var(--surface)]"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About | 919Events' },
      { name: 'description', content: 'Learn about 919Events and our mission to help you discover local events.' },
      { property: 'og:title', content: 'About | 919Events' },
      { property: 'og:description', content: 'Learn about 919Events and our mission to help you discover local events.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/about' },
    ],
  }),
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">About</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Events for everyone.
        </h1>
        <div className="mt-4 max-w-3xl space-y-5 text-base leading-8 text-[var(--sea-ink-soft)]">
          <p>
            We built this platform because we believe finding things to do in
            your own community shouldn't come with strings attached. No
            gatekeeping, no litmus tests, no judgment — just events, all in
            one place.
          </p>
          <p>
            Local Events is a centralized, open hub where business owners and
            event promoters can share what's happening and where locals can
            discover and save the things that interest them. Whether it's a
            neighborhood block party, a concert downtown, or a weekend
            festival, everyone deserves equal access to what's going on around
            them.
          </p>
          <p>
            We're committed to keeping this space welcoming for all people,
            regardless of background, identity, or personal beliefs. The only
            thing that matters here is bringing the community together.
          </p>
        </div>
      </section>
    </main>
  )
}

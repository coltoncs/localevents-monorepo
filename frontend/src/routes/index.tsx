import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { LocationSearch } from '#/components/maps/LocationSearch'
import { EventCarousel } from '#/components/events/EventCarousel'
import { RecommendedEventsSection } from '#/components/events/RecommendedEventsSection'
import { useSavedEvents } from '#/lib/hooks/useSavedEvents'
import { useUser } from '#/lib/hooks/useUser'

gsap.registerPlugin(SplitText)

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: '919Events - Discover Local Events Near You' },
      { name: 'description', content: 'Find local concerts, meetups, festivals, and more happening in your area. Never miss out on what\'s going on nearby.' },
      { property: 'og:title', content: '919Events - Discover Local Events Near You' },
      { property: 'og:description', content: 'Find local concerts, meetups, festivals, and more happening in your area.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/' },
    ],
  }),
  component: HomePage,
})

const CYCLING_WORDS = [
  'You',
  'Raleigh',
  'Durham',
  'Clayton',
  'Charlotte',
  'Greensboro',
  'Wilmington',
  'Asheville',
  'Chapel Hill',
  'Fayetteville',
  'Richmond',
  'Virginia Beach',
  'Norfolk',
  'Charlottesville',
  'Roanoke',
  'Charleston',
  'Columbia',
  'Greenville',
  'Myrtle Beach',
]

function CyclingWord() {
  const textRef = useRef<HTMLSpanElement>(null)
  const idxRef = useRef(0)

  useGSAP(() => {
    if (!textRef.current) return

    const cycle = () => {
      idxRef.current = (idxRef.current + 1) % CYCLING_WORDS.length
      const nextWord = CYCLING_WORDS[idxRef.current]

      // Phase 1: clear current text letter by letter from end
      const outSplit = SplitText.create(textRef.current!, { type: 'chars' })
      gsap.to(outSplit.chars, {
        opacity: 0,
        duration: 0.03,
        stagger: { each: 0.04, from: 'end' },
        ease: 'none',
        onComplete: () => {
          outSplit.revert()
          textRef.current!.textContent = nextWord

          // Phase 2: build new text letter by letter from start
          const inSplit = SplitText.create(textRef.current!, { type: 'chars' })
          gsap.set(inSplit.chars, { opacity: 0 })
          gsap.to(inSplit.chars, {
            opacity: 1,
            duration: 0.03,
            stagger: 0.04,
            ease: 'none',
            onComplete: () => {
              inSplit.revert()
              gsap.delayedCall(2, cycle)
            },
          })
        },
      })
    }

    gsap.delayedCall(2.8, cycle)
  }, { scope: textRef })

  return (
    <span
      ref={textRef}
      style={{ display: 'inline-block' }}
    >
      {CYCLING_WORDS[0]}
    </span>
  )
}

function UpcomingSavedEvents() {
  const { data: saved } = useSavedEvents()

  const upcoming = saved
    ?.filter(event => new Date(event.StartTime) > new Date())
    .sort((a, b) => new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime())
    .slice(0, 6)

  if (!upcoming?.length) return null

  return (
    <div className="mt-12 w-full max-w-5xl text-left">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-(--sea-ink)">Your Upcoming Saved Events</h2>
        <Link
          to="/saved"
          className="text-sm font-medium text-(--lagoon-deep) hover:text-(--lagoon)"
        >
          View all
        </Link>
      </div>
      <EventCarousel events={upcoming} />
    </div>
  )
}

function HomePage() {
  const { isSignedIn } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
        Discover Events
        <span className="block text-(--lagoon-deep)">
          Near <CyclingWord />
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-(--sea-ink-soft)">
        Find local concerts, meetups, festivals, and more happening in your
        area. Never miss out on what&apos;s going on nearby.
      </p>
      <div className="mt-8 flex justify-center">
        <LocationSearch navigateTo="/events" />
      </div>
      {isSignedIn && (
        <div className="mt-6 flex gap-4">
          <Link
            to="/submit"
            className="rounded-md border border-(--line) bg-(--surface-strong) px-6 py-3 text-sm font-semibold text-(--sea-ink) shadow-sm hover:bg-(--surface)"
          >
            Submit an Event
          </Link>
        </div>
      )}
      {isSignedIn && <UpcomingSavedEvents />}
      {isSignedIn && <SignedInRecommendations />}
    </div>
  )
}

function SignedInRecommendations() {
  const { data: user } = useUser()
  const lat = user?.DefaultLatitude
  const lng = user?.DefaultLongitude
  if (lat == null || lng == null) return null
  return (
    <RecommendedEventsSection
      lat={lat}
      lng={lng}
      radius={user?.DefaultRadiusMiles ?? undefined}
    />
  )
}

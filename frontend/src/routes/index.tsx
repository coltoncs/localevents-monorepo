import { useAuth } from '@clerk/clerk-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { LocationSearch } from '#/components/LocationSearch'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const CYCLING_WORDS = [
  'You',
  'Raleigh',
  'Durham',
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
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase('out')
      timeoutRef.current = setTimeout(() => {
        setIdx((i) => (i + 1) % CYCLING_WORDS.length)
        setPhase('in')
      }, 350)
    }, 2800)

    return () => {
      clearInterval(interval)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <span
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        verticalAlign: 'bottom',
        paddingBottom: '0.15em',
        marginBottom: '-0.15em',
      }}
    >
      <span
        key={`${idx}-${phase}`}
        style={{
          display: 'inline-block',
          animation:
            phase === 'in'
              ? 'word-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both'
              : 'word-out 0.35s ease-in both',
        }}
      >
        {CYCLING_WORDS[idx]}
      </span>
    </span>
  )
}

function HomePage() {
  const { isSignedIn } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
        Discover Events
        <span className="block text-[var(--lagoon-deep)]">
          Near <CyclingWord />
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-[var(--sea-ink-soft)]">
        Find local concerts, meetups, festivals, and more happening in your
        area. Never miss out on what&apos;s going on nearby.
      </p>
      <div className="mt-8 flex justify-center">
        <LocationSearch />
      </div>
      {isSignedIn && (
        <div className="mt-6 flex gap-4">
          <Link
            to="/submit"
            className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-6 py-3 text-sm font-semibold text-[var(--sea-ink)] shadow-sm hover:bg-[var(--surface)]"
          >
            Submit an Event
          </Link>
        </div>
      )}
    </div>
  )
}

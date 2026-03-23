import { Link } from '@tanstack/react-router'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-[var(--line)] px-4 pb-14 pt-10 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-sm">
          &copy; {year} 919Events. Find what&apos;s happening near you.
        </p>
        <nav className="flex gap-4">
          <Link
            to="/donate"
            className="text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
          >
            Donate
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}

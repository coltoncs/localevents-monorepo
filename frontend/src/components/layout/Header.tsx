import { useAuth } from "@clerk/clerk-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";
import { useState } from "react";
import { useUserRole } from "#/lib/hooks/useUserRole";
import ClerkHeader from "../../integrations/clerk/header-user.tsx";
import ThemeToggle from "../ThemeToggle";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { canCreateEvent, canManageAuthors } = useUserRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  // The map view renders its own navbar with a "List" button; this is the
  // list view's counterpart.
  const onEventsList = useRouterState({
    select: (s) =>
      s.location.pathname === "/events" &&
      (s.location.search as { view?: string }).view === "list",
  });

  const navLinks = (
    <>
      <Link
        to="/events"
        className="nav-link"
        activeProps={{ className: "nav-link is-active" }}
        onClick={() => setMenuOpen(false)}
      >
        Events
      </Link>
      {isSignedIn && (
        <Link
          to="/planner"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
          onClick={() => setMenuOpen(false)}
        >
          Planner
        </Link>
      )}
      {/* <Link
				to="/places"
				search={{ tab: "food" }}
				activeOptions={{ includeSearch: false }}
				className="nav-link"
				activeProps={{ className: "nav-link is-active" }}
				onClick={() => setMenuOpen(false)}
			>
				Places
			</Link> */}
      <Link
        to="/submit"
        className="nav-link"
        activeProps={{ className: "nav-link is-active" }}
        onClick={() => setMenuOpen(false)}
      >
        Submit Event
      </Link>
      {isSignedIn && canCreateEvent && (
        <Link
          to="/my-events"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
          onClick={() => setMenuOpen(false)}
        >
          My Events
        </Link>
      )}
      {isSignedIn && canManageAuthors && (
        <Link
          to="/admin"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      )}
      {isSignedIn && (
        <Link
          to="/profile"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
          onClick={() => setMenuOpen(false)}
        >
          Profile
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-lg sm:px-4">
      <nav className="page-wrap flex items-center gap-x-2 py-3 sm:gap-x-3 sm:py-4">
        <Link
          to="/"
          className="shrink-0 text-base font-bold tracking-tight text-(--sea-ink) no-underline"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))] shadow-[0_0_10px_var(--lagoon)]" />
            919Events
          </span>
        </Link>

        {/* Hamburger button — mobile only */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center justify-center rounded-md p-2 text-(--sea-ink-soft) hover:bg-(--surface) sm:hidden"
          aria-label="Toggle navigation menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-x-4 text-sm font-semibold sm:flex">
          {navLinks}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
          {onEventsList && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/events",
                  search: (prev) => ({
                    ...prev,
                    view: undefined,
                    page: undefined,
                  }),
                  replace: true,
                })
              }
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-2.5 py-1.5 text-sm font-semibold text-(--sea-ink) hover:bg-(--link-bg-hover) sm:px-3"
              aria-label="Switch to map view"
            >
              <MapIcon size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Map</span>
            </button>
          )}
          <ThemeToggle />
          <ClerkHeader />
        </div>
      </nav>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-lg sm:hidden">
          <div className="page-wrap flex flex-col px-4 py-2 text-sm font-semibold [&>a]:flex [&>a]:min-h-11 [&>a]:items-center">
            {navLinks}
          </div>
        </div>
      )}
    </header>
  );
}

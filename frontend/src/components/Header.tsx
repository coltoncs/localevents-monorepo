import { useAuth } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useUserRole } from "#/lib/hooks/useUserRole";
import ClerkHeader from "../integrations/clerk/header-user.tsx";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	const { isSignedIn } = useAuth();
	const { isUser, canCreateEvent, canManageAuthors } = useUserRole();
	const [menuOpen, setMenuOpen] = useState(false);

	const navLinks = (
		<>
			<Link
				to="/"
				className="nav-link"
				activeProps={{ className: "nav-link is-active" }}
				onClick={() => setMenuOpen(false)}
			>
				Home
			</Link>
			<Link
				to="/events"
				className="nav-link"
				activeProps={{ className: "nav-link is-active" }}
				onClick={() => setMenuOpen(false)}
			>
				Events
			</Link>
			<Link
				to="/beverages"
				className="nav-link"
				activeProps={{ className: "nav-link is-active" }}
				onClick={() => setMenuOpen(false)}
			>
				Drinks
			</Link>
			{isSignedIn && canCreateEvent && (
				<Link
					to="/submit"
					className="nav-link"
					activeProps={{ className: "nav-link is-active" }}
					onClick={() => setMenuOpen(false)}
				>
					Submit Event
				</Link>
			)}
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
			{isSignedIn && isUser && (
				<Link
					to="/apply-author"
					className="nav-link"
					activeProps={{ className: "nav-link is-active" }}
					onClick={() => setMenuOpen(false)}
				>
					Apply to be Author
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
				<>
					<Link
						to="/saved"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
						onClick={() => setMenuOpen(false)}
					>
						Saved
					</Link>
					<Link
						to="/settings"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
						onClick={() => setMenuOpen(false)}
					>
						Settings
					</Link>
				</>
			)}
		</>
	);

	return (
		<header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
			<nav className="page-wrap flex items-center gap-x-3 py-3 sm:py-4">
				<Link
					to="/"
					className="shrink-0 text-base font-bold tracking-tight text-(--sea-ink) no-underline"
				>
					<span className="inline-flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
						919Events
					</span>
				</Link>

				{/* Hamburger button — mobile only */}
				<button
					type="button"
					onClick={() => setMenuOpen((o) => !o)}
					className="ml-2 inline-flex items-center justify-center rounded-md p-2 text-(--sea-ink-soft) hover:bg-(--surface) sm:hidden"
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

				<div className="ml-auto flex items-center gap-2">
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

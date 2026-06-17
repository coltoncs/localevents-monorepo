import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Music nav item with a dropdown (Concerts / Venues). Used in both the main
// Header and the fullscreen-map nav. onNavigate lets the parent close its
// mobile menu when a destination is picked.
export function MusicNavDropdown({ onNavigate }: { onNavigate?: () => void }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const { pathname } = useLocation();
	const isActive = pathname.startsWith("/music");

	useEffect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [open]);

	function pick() {
		setOpen(false);
		onNavigate?.();
	}

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-haspopup="menu"
				className={`nav-link inline-flex cursor-pointer items-center gap-1 ${
					isActive ? "is-active" : ""
				}`}
			>
				Music
				<svg
					width="10"
					height="10"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					className={`transition-transform ${open ? "rotate-180" : ""}`}
				>
					<path d="M2 4l4 4 4-4" />
				</svg>
			</button>

			{open && (
				<div
					role="menu"
					className="absolute left-0 top-full z-50 mt-1 min-w-40 rounded-md border border-(--line) bg-(--header-bg) p-1 shadow-lg backdrop-blur-lg"
				>
					<Link
						to="/music/concerts"
						role="menuitem"
						className="block rounded px-3 py-2 text-sm text-(--sea-ink) hover:bg-(--surface)"
						activeProps={{
							className:
								"block rounded px-3 py-2 text-sm text-(--lagoon-deep) bg-(--surface)",
						}}
						onClick={pick}
					>
						Concerts
					</Link>
					<Link
						to="/music/venues"
						role="menuitem"
						className="block rounded px-3 py-2 text-sm text-(--sea-ink) hover:bg-(--surface)"
						activeProps={{
							className:
								"block rounded px-3 py-2 text-sm text-(--lagoon-deep) bg-(--surface)",
						}}
						onClick={pick}
					>
						Venues
					</Link>
					<Link
						to="/music/artists"
						role="menuitem"
						className="block rounded px-3 py-2 text-sm text-(--sea-ink) hover:bg-(--surface)"
						activeProps={{
							className:
								"block rounded px-3 py-2 text-sm text-(--lagoon-deep) bg-(--surface)",
						}}
						onClick={pick}
					>
						Artists
					</Link>
				</div>
			)}
		</div>
	);
}

// Small "Featured" pill shown on featured events across card, detail, and
// other surfaces. Pure presentational — callers decide when to render it.
export function FeaturedBadge({ className = "" }: { className?: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ${className}`}
		>
			<span aria-hidden>★</span>
			Featured
		</span>
	);
}

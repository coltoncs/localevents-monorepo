import { X } from "lucide-react";
import { dismissToast, useToasts } from "#/lib/toast";

// Renders queued toasts top-center, below the sticky header, so they don't
// collide with the chat launcher (bottom-right) or devtools (bottom-left).
// The <output> (implicit role="status") live region is always mounted so
// screen readers announce new toasts.
export function Toaster() {
	const toasts = useToasts();

	return (
		<output
			aria-live="polite"
			className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex flex-col items-center gap-2 px-4"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					className="pointer-events-auto flex max-w-sm animate-[fullscreen-slide-up_200ms_ease-out] items-start gap-3 rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-2.5 text-sm text-(--sea-ink) shadow-lg"
				>
					<span className="flex-1">{t.message}</span>
					<button
						type="button"
						onClick={() => dismissToast(t.id)}
						aria-label="Dismiss"
						className="-mr-1 cursor-pointer rounded p-0.5 text-(--sea-ink-soft) hover:text-(--sea-ink)"
					>
						<X size={14} aria-hidden="true" />
					</button>
				</div>
			))}
		</output>
	);
}

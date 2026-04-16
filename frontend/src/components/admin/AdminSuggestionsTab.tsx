import { useMemo, useState } from "react";
import { Spinner } from "#/components/Spinner";
import { SuggestionCard } from "#/components/SuggestionCard";
import { usePendingSuggestions } from "#/lib/hooks/useSuggestions";
import type { EditSuggestion, SuggestionAction } from "#/lib/types";

type TargetFilter = EditSuggestion["TargetType"] | "all";
type ActionFilter = SuggestionAction | "all";

const TARGET_OPTIONS: { id: TargetFilter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "event", label: "Events" },
	{ id: "venue", label: "Venues" },
	{ id: "beverage", label: "Bars & Breweries" },
];

const ACTION_OPTIONS: { id: ActionFilter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "edit", label: "Edits" },
	{ id: "create", label: "Creates" },
	{ id: "delete", label: "Deletes" },
];

export function AdminSuggestionsTab({
	targetType,
}: {
	targetType?: EditSuggestion["TargetType"];
}) {
	const { data: suggestions, isLoading } = usePendingSuggestions();
	const [targetFilter, setTargetFilter] = useState<TargetFilter>(
		targetType ?? "all",
	);
	const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

	const filtered = useMemo(() => {
		if (!suggestions) return [];
		return suggestions.filter((s) => {
			if (targetType && s.TargetType !== targetType) return false;
			if (targetFilter !== "all" && s.TargetType !== targetFilter) return false;
			if (actionFilter !== "all" && (s.Action ?? "edit") !== actionFilter)
				return false;
			return true;
		});
	}, [suggestions, targetType, targetFilter, actionFilter]);

	return (
		<div className="space-y-4">
			{!targetType && (
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex rounded-lg border border-(--line) p-0.5">
						{TARGET_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setTargetFilter(opt.id)}
								className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
									targetFilter === opt.id
										? "bg-(--lagoon) text-white"
										: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>

					<div className="flex rounded-lg border border-(--line) p-0.5">
						{ACTION_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setActionFilter(opt.id)}
								className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
									actionFilter === opt.id
										? "bg-(--lagoon) text-white"
										: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>

					<span className="text-sm text-(--sea-ink-soft)">
						{filtered.length} pending
					</span>
				</div>
			)}

			{isLoading && <Spinner className="py-12" />}

			{!isLoading && filtered.length === 0 && (
				<p className="py-8 text-center text-(--sea-ink-soft)">
					No pending suggestions.
				</p>
			)}

			<div className="space-y-4">
				{filtered.map((s) => (
					<SuggestionCard key={s.ID} suggestion={s} />
				))}
			</div>
		</div>
	);
}

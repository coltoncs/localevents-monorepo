import { useNavigate } from "@tanstack/react-router";

export type AdminTab =
	| "dashboard"
	| "applications"
	| "suggestions"
	| "beverages"
	| "ops";

const TABS: { id: AdminTab; label: string }[] = [
	{ id: "dashboard", label: "Dashboard" },
	{ id: "applications", label: "Applications" },
	{ id: "suggestions", label: "Suggestions" },
	{ id: "beverages", label: "Beverages" },
	{ id: "ops", label: "Ops" },
];

export function AdminTabNav({
	active,
	counts,
}: {
	active: AdminTab;
	counts?: Partial<Record<AdminTab, number>>;
}) {
	const navigate = useNavigate();

	return (
		<div className="inline-flex flex-wrap rounded-lg border border-(--line) p-0.5">
			{TABS.map((tab) => {
				const isActive = tab.id === active;
				const count = counts?.[tab.id];
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() =>
							navigate({
								to: "/admin",
								search: { tab: tab.id === "dashboard" ? undefined : tab.id },
								replace: true,
							})
						}
						className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							isActive
								? "bg-(--lagoon) text-white"
								: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
						}`}
					>
						{tab.label}
						{count !== undefined && count > 0 && (
							<span
								className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
									isActive
										? "bg-white/20 text-white"
										: "bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)"
								}`}
							>
								{count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

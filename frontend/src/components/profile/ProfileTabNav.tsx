import { useNavigate } from "@tanstack/react-router";

export type ProfileTab = "overview" | "saved" | "checkins" | "settings";

const TABS: { id: ProfileTab; label: string }[] = [
	{ id: "overview", label: "Overview" },
	{ id: "saved", label: "Saved" },
	{ id: "checkins", label: "Check-ins" },
	{ id: "settings", label: "Settings" },
];

export function ProfileTabNav({ active }: { active: ProfileTab }) {
	const navigate = useNavigate();

	return (
		<div className="inline-flex flex-wrap rounded-lg border border-(--line) p-0.5">
			{TABS.map((tab) => {
				const isActive = tab.id === active;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() =>
							navigate({
								to: "/profile",
								search: { tab: tab.id === "overview" ? undefined : tab.id },
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
					</button>
				);
			})}
		</div>
	);
}

import { Link, useNavigate } from "@tanstack/react-router";
import { Beer, Bookmark, MapPin, Wine } from "lucide-react";
import { Spinner } from "#/components/Spinner";
import { useMyCheckIns } from "#/lib/hooks/useBeverageCheckIns";
import { useSavedEvents } from "#/lib/hooks/useSavedEvents";
import { useUser } from "#/lib/hooks/useUser";

function formatMonthYear(iso: string) {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

export function ProfileOverviewTab() {
	const { data: user, isLoading: userLoading } = useUser();
	const { data: saved, isLoading: savedLoading } = useSavedEvents();
	const { data: checkInsData, isLoading: checkInsLoading } = useMyCheckIns();
	const navigate = useNavigate();

	if (userLoading || savedLoading || checkInsLoading) {
		return <Spinner className="py-12" />;
	}

	const stats = checkInsData?.stats;
	const recentCheckIns = checkInsData?.checkins.slice(0, 3) ?? [];
	const recentSaved = saved?.slice(0, 3) ?? [];

	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
				<h2 className="text-lg font-semibold text-(--sea-ink)">
					{user?.Username || user?.Email || "Welcome"}
				</h2>
				{user?.CreatedAt && (
					<p className="mt-0.5 text-sm text-(--sea-ink-soft)">
						Member since {formatMonthYear(user.CreatedAt)}
					</p>
				)}
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatTile
					icon={<Bookmark size={18} />}
					label="Saved events"
					value={saved?.length ?? 0}
					onClick={() => navigate({ to: "/profile", search: { tab: "saved" } })}
				/>
				<StatTile
					icon={<MapPin size={18} />}
					label="Check-ins"
					value={stats?.total_checkins ?? 0}
					onClick={() =>
						navigate({ to: "/profile", search: { tab: "checkins" } })
					}
				/>
				<StatTile
					icon={<Beer size={18} />}
					label="Breweries visited"
					value={stats?.unique_breweries ?? 0}
					onClick={() =>
						navigate({ to: "/profile", search: { tab: "checkins" } })
					}
				/>
				<StatTile
					icon={<Wine size={18} />}
					label="Bars visited"
					value={stats?.unique_bars ?? 0}
					onClick={() =>
						navigate({ to: "/profile", search: { tab: "checkins" } })
					}
				/>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<section>
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-sm font-semibold text-(--sea-ink)">
							Recent check-ins
						</h3>
						{recentCheckIns.length > 0 && (
							<Link
								to="/profile"
								search={{ tab: "checkins" }}
								className="text-xs font-medium text-(--lagoon-deep) no-underline hover:text-(--lagoon)"
							>
								View all
							</Link>
						)}
					</div>
					{recentCheckIns.length === 0 ? (
						<EmptyPanel>
							No check-ins yet.{" "}
							<Link
								to="/places"
								search={{ tab: "food" }}
								className="font-medium text-(--lagoon-deep) no-underline"
							>
								Find a spot
							</Link>
							.
						</EmptyPanel>
					) : (
						<ul className="space-y-2">
							{recentCheckIns.map((c) => (
								<li key={c.id}>
									<Link
										to="/drinks/$beverageId"
										params={{ beverageId: c.beverage_id }}
										className="flex items-center justify-between rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2 no-underline hover:bg-(--surface)"
									>
										<span className="truncate text-sm text-(--sea-ink)">
											{c.beverage_name}
										</span>
										<span className="shrink-0 pl-3 text-xs text-(--sea-ink-soft)">
											{new Date(
												`${c.checkin_date}T00:00:00`,
											).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
											})}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>

				<section>
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-sm font-semibold text-(--sea-ink)">
							Recent saves
						</h3>
						{recentSaved.length > 0 && (
							<Link
								to="/profile"
								search={{ tab: "saved" }}
								className="text-xs font-medium text-(--lagoon-deep) no-underline hover:text-(--lagoon)"
							>
								View all
							</Link>
						)}
					</div>
					{recentSaved.length === 0 ? (
						<EmptyPanel>
							Nothing saved yet.{" "}
							<Link
								to="/events"
								className="font-medium text-(--lagoon-deep) no-underline"
							>
								Browse events
							</Link>
							.
						</EmptyPanel>
					) : (
						<ul className="space-y-2">
							{recentSaved.map((event) => (
								<li key={event.ID}>
									<Link
										to="/events/$eventId"
										params={{ eventId: event.ID }}
										className="flex items-center justify-between rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2 no-underline hover:bg-(--surface)"
									>
										<span className="truncate text-sm text-(--sea-ink)">
											{event.Title}
										</span>
										<span className="shrink-0 pl-3 text-xs text-(--sea-ink-soft)">
											{new Date(event.StartTime).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
											})}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}

function StatTile({
	icon,
	label,
	value,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
	onClick?: () => void;
}) {
	const Comp = onClick ? "button" : "div";
	return (
		<Comp
			type={onClick ? "button" : undefined}
			onClick={onClick}
			className={`rounded-lg border border-(--line) bg-(--surface-strong) p-4 text-left ${
				onClick ? "cursor-pointer hover:bg-(--surface)" : ""
			}`}
		>
			<div className="flex items-center gap-2 text-(--sea-ink-soft)">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<p className="mt-1 text-2xl font-bold text-(--sea-ink)">
				{value.toLocaleString()}
			</p>
		</Comp>
	);
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-dashed border-(--line) px-4 py-8 text-center text-sm text-(--sea-ink-soft)">
			{children}
		</div>
	);
}

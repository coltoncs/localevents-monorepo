import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { Spinner } from "#/components/Spinner";
import { useAdminStats } from "#/lib/hooks/useAdminStats";
import type { AdminStats } from "#/lib/types";

function MetricCard({
	label,
	value,
}: {
	label: string;
	value: string | number;
}) {
	const numRef = useRef<HTMLParagraphElement>(null);
	const isNumber = typeof value === "number";

	useGSAP(() => {
		if (!isNumber || !numRef.current) return;
		const obj = { val: 0 };
		gsap.to(obj, {
			val: value,
			duration: 1,
			ease: "power2.out",
			onUpdate() {
				if (numRef.current) {
					numRef.current.textContent = Math.round(obj.val).toLocaleString();
				}
			},
		});
	}, [value]);

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<p className="text-sm text-(--sea-ink-soft)">{label}</p>
			<p ref={numRef} className="mt-1 text-2xl font-bold text-(--sea-ink)">
				{isNumber ? "0" : value}
			</p>
		</div>
	);
}

function EventSourcesPanel({
	sources,
}: {
	sources: AdminStats["events_by_source"];
}) {
	const total = sources.reduce((sum, s) => sum + s.count, 0);
	const containerRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (sources.length === 0 || !containerRef.current) return;
			const bars =
				containerRef.current.querySelectorAll<HTMLElement>("[data-bar]");
			const counts =
				containerRef.current.querySelectorAll<HTMLElement>("[data-count]");

			gsap.from(bars, {
				width: 0,
				duration: 0.8,
				ease: "power2.out",
				stagger: 0.08,
			});

			for (const el of counts) {
				const target = Number(el.dataset.count);
				const obj = { val: 0 };
				gsap.to(obj, {
					val: target,
					duration: 0.8,
					ease: "power2.out",
					delay: 0.08 * Array.from(counts).indexOf(el),
					onUpdate() {
						el.textContent = Math.round(obj.val).toLocaleString();
					},
				});
			}
		},
		{ scope: containerRef, dependencies: [sources] },
	);

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<h3 className="font-semibold text-(--sea-ink)">Events by Source</h3>
			{sources.length === 0 ? (
				<p className="mt-2 text-sm text-(--sea-ink-soft)">
					No upcoming events.
				</p>
			) : (
				<div ref={containerRef} className="mt-3 space-y-2">
					{sources.map((s) => (
						<div
							key={s.source}
							className="flex items-center justify-between text-sm"
						>
							<span className="text-(--sea-ink)">{s.source}</span>
							<div className="flex items-center gap-2">
								<div
									data-bar=""
									className="h-2 rounded-full bg-[rgba(79,184,178,0.3)]"
									style={{ width: `${Math.max((s.count / total) * 120, 8)}px` }}
								/>
								<span
									data-count={s.count}
									className="tabular-nums text-(--sea-ink-soft)"
								>
									0
								</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function DigestStatsPanel({
	digests,
}: {
	digests: AdminStats["recent_digests"];
}) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<h3 className="font-semibold text-(--sea-ink)">Digest Stats (7 days)</h3>
			<div className="mt-2 grid grid-cols-3 gap-3 text-center">
				<div>
					<p className="text-lg font-bold text-green-600">{digests.sent}</p>
					<p className="text-xs text-(--sea-ink-soft)">Sent</p>
				</div>
				<div>
					<p className="text-lg font-bold text-red-500">{digests.failed}</p>
					<p className="text-xs text-(--sea-ink-soft)">Failed</p>
				</div>
				<div>
					<p className="text-lg font-bold text-(--sea-ink)">
						{digests.total_events_included}
					</p>
					<p className="text-xs text-(--sea-ink-soft)">Events Sent</p>
				</div>
			</div>
		</div>
	);
}

export function AdminDashboardTab() {
	const { data: stats, isLoading } = useAdminStats();

	if (isLoading) return <Spinner className="py-12" />;
	if (!stats) return null;

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<MetricCard label="Total Users" value={stats.total_users} />
				<MetricCard label="Weekly Active" value={stats.weekly_active_users} />
				<MetricCard label="New This Week" value={stats.new_users_this_week} />
				<MetricCard label="Email Subscribers" value={stats.email_subscribers} />
				<MetricCard label="SMS Subscribers" value={stats.sms_subscribers} />
				<MetricCard
					label="Upcoming Events"
					value={stats.total_upcoming_events}
				/>
				<MetricCard label="Venues" value={stats.total_venues} />
				<MetricCard label="Total Saves" value={stats.total_saved_events} />
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<EventSourcesPanel sources={stats.events_by_source} />
				<DigestStatsPanel digests={stats.recent_digests} />
			</div>
		</div>
	);
}

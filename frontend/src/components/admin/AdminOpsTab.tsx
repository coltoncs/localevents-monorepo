import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "#/lib/api";
import { useAdminStats } from "#/lib/hooks/useAdminStats";
import type { AdminStats } from "#/lib/types";

interface SocialCard {
	city: string;
	url: string;
	count: number;
}

function CronStatusPanel({
	lastScrape,
	lastCleanup,
}: {
	lastScrape: AdminStats["last_scrape"];
	lastCleanup: AdminStats["last_cleanup"];
}) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-2">
			<h3 className="font-semibold text-(--sea-ink)">Cron Jobs</h3>
			{lastScrape ? (
				<p className="text-sm text-(--sea-ink)">
					Last scrape:{" "}
					<span className="font-medium">
						{lastScrape.items_affected} events
					</span>
					{lastScrape.details?.mirrored
						? `, ${lastScrape.details.mirrored} images`
						: ""}
					<span className="text-(--sea-ink-soft)">
						{" "}
						— {new Date(lastScrape.ran_at).toLocaleString()}
					</span>
				</p>
			) : (
				<p className="text-sm text-(--sea-ink-soft)">No scrape data yet.</p>
			)}
			{lastCleanup ? (
				<p className="text-sm text-(--sea-ink)">
					Last cleanup:{" "}
					<span className="font-medium">
						{lastCleanup.items_affected} events removed
					</span>
					{lastCleanup.details?.images_deleted
						? `, ${lastCleanup.details.images_deleted} images`
						: ""}
					<span className="text-(--sea-ink-soft)">
						{" "}
						— {new Date(lastCleanup.ran_at).toLocaleString()}
					</span>
				</p>
			) : (
				<p className="text-sm text-(--sea-ink-soft)">No cleanup data yet.</p>
			)}
		</div>
	);
}

function DigestTrigger() {
	const trigger = useMutation({
		mutationFn: () =>
			apiClient<{ status: string }>("/api/admin/digest/trigger", {
				method: "POST",
			}),
	});

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-(--sea-ink)">Weekly Digest</h3>
					<p className="text-sm text-(--sea-ink-soft)">
						Send the weekly event digest to all subscribed users now.
					</p>
				</div>
				<button
					type="button"
					onClick={() => trigger.mutate()}
					disabled={trigger.isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon) disabled:opacity-50"
				>
					{trigger.isPending ? "Sending..." : "Send Digest"}
				</button>
			</div>
			{trigger.isSuccess && (
				<p className="mt-2 text-sm text-green-600">
					Digest triggered successfully. Check server logs for details.
				</p>
			)}
			{trigger.isError && (
				<p className="mt-2 text-sm text-red-600">Failed to trigger digest.</p>
			)}
		</div>
	);
}

function ymd(d: Date): string {
	const tzOffset = d.getTimezoneOffset() * 60000;
	return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function SocialCardGenerator() {
	const today = new Date();
	const weekLater = new Date();
	weekLater.setDate(today.getDate() + 6);

	const [start, setStart] = useState(ymd(today));
	const [end, setEnd] = useState(ymd(weekLater));
	const [heading, setHeading] = useState("");
	const [email, setEmail] = useState("");
	const [selectedCities, setSelectedCities] = useState<string[]>([]);

	const { data: cityData } = useQuery({
		queryKey: ["admin", "social", "cities"],
		queryFn: () => apiClient<{ cities: string[] }>("/api/admin/social/cities"),
	});
	const cities = cityData?.cities ?? [];

	const toggleCity = (city: string) =>
		setSelectedCities((prev) =>
			prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
		);

	const generate = useMutation({
		mutationFn: () =>
			apiClient<{ cards: SocialCard[]; count: number }>(
				"/api/admin/social/generate",
				{
					method: "POST",
					body: JSON.stringify({
						start,
						end,
						cities: selectedCities, // empty = all configured
						heading: heading.trim(),
						email: email.trim(),
					}),
				},
			),
	});

	const cards = generate.data?.cards ?? [];

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4">
			<div>
				<h3 className="font-semibold text-(--sea-ink)">Social Cards</h3>
				<p className="text-sm text-(--sea-ink-soft)">
					Generate event cards for a date range and email them for posting.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className="flex flex-col gap-1 text-sm text-(--sea-ink)">
					Start date
					<input
						type="date"
						value={start}
						onChange={(e) => setStart(e.target.value)}
						className="rounded-md border border-(--line) bg-(--surface) px-3 py-2"
					/>
				</label>
				<label className="flex flex-col gap-1 text-sm text-(--sea-ink)">
					End date
					<input
						type="date"
						value={end}
						min={start}
						onChange={(e) => setEnd(e.target.value)}
						className="rounded-md border border-(--line) bg-(--surface) px-3 py-2"
					/>
				</label>
			</div>

			{cities.length > 0 && (
				<div className="space-y-1">
					<span className="text-sm text-(--sea-ink)">
						Cities{" "}
						<span className="text-(--sea-ink-soft)">(none selected = all)</span>
					</span>
					<div className="flex flex-wrap gap-3">
						{cities.map((city) => (
							<label
								key={city}
								className="flex items-center gap-1.5 text-sm text-(--sea-ink)"
							>
								<input
									type="checkbox"
									checked={selectedCities.includes(city)}
									onChange={() => toggleCity(city)}
								/>
								{city}
							</label>
						))}
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className="flex flex-col gap-1 text-sm text-(--sea-ink)">
					Heading (optional)
					<input
						type="text"
						value={heading}
						placeholder="Events"
						onChange={(e) => setHeading(e.target.value)}
						className="rounded-md border border-(--line) bg-(--surface) px-3 py-2"
					/>
				</label>
				<label className="flex flex-col gap-1 text-sm text-(--sea-ink)">
					Email to (optional)
					<input
						type="email"
						value={email}
						placeholder="defaults to admin alert email"
						onChange={(e) => setEmail(e.target.value)}
						className="rounded-md border border-(--line) bg-(--surface) px-3 py-2"
					/>
				</label>
			</div>

			<button
				type="button"
				onClick={() => generate.mutate()}
				disabled={generate.isPending}
				className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon) disabled:opacity-50"
			>
				{generate.isPending ? "Generating..." : "Generate & email"}
			</button>

			{generate.isError && (
				<p className="text-sm text-red-600">
					Failed: {(generate.error as Error).message}
				</p>
			)}
			{generate.isSuccess &&
				(cards.length > 0 ? (
					<div className="space-y-2">
						<p className="text-sm text-green-600">
							Generated {cards.length} card{cards.length === 1 ? "" : "s"} and
							emailed the gallery.
						</p>
						<div className="flex flex-wrap gap-3">
							{cards.map((card) => (
								<a
									key={card.url}
									href={card.url}
									target="_blank"
									rel="noreferrer"
									className="block w-32"
								>
									<img
										src={card.url}
										alt={`${card.city} card`}
										className="w-32 rounded-md border border-(--line)"
									/>
									<span className="text-xs text-(--sea-ink-soft)">
										{card.city} · {card.count} events
									</span>
								</a>
							))}
						</div>
					</div>
				) : (
					<p className="text-sm text-(--sea-ink-soft)">
						No events found in that range for the selected cities — nothing to
						generate.
					</p>
				))}
		</div>
	);
}

export function AdminOpsTab() {
	const { data: stats } = useAdminStats();

	return (
		<div className="space-y-6">
			{stats && (
				<CronStatusPanel
					lastScrape={stats.last_scrape}
					lastCleanup={stats.last_cleanup}
				/>
			)}
			<DigestTrigger />
			<SocialCardGenerator />
		</div>
	);
}

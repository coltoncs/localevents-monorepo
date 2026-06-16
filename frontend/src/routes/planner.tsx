import { SignUpButton, useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CATEGORIES } from "#/components/events/EventFilters";
import {
	LocationPicker,
	type LocationValue,
} from "#/components/maps/LocationPicker";
import { Itinerary } from "#/components/planner/Itinerary";
import { Spinner } from "#/components/Spinner";
import { useNotificationPreferences } from "#/lib/hooks/useNotifications";
import {
	type PlannerComputeArgs,
	usePlanner,
	usePlannerCompute,
} from "#/lib/hooks/usePlanner";
import { useUser } from "#/lib/hooks/useUser";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export const Route = createFileRoute("/planner")({
	component: PlannerPage,
});

function PlannerPage() {
	const { isLoaded, isSignedIn } = useAuth();
	if (!isLoaded) return <Spinner className="py-12" />;
	return (
		<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="mb-6">
				<h1 className="text-2xl font-bold text-(--sea-ink)">Your Week Ahead</h1>
				<p className="mt-1 text-sm text-(--sea-ink-soft)">
					A daily itinerary of events near you, sorted by what you'll love and
					what's closest.
				</p>
			</header>
			{isSignedIn ? <AuthedPlanner /> : <AnonPlanner />}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Anonymous: one-time, transient plan + sign-up funnel.
// ---------------------------------------------------------------------------
function AnonPlanner() {
	const compute = usePlannerCompute();
	const plan = compute.data?.plan;

	return (
		<div className="space-y-6">
			<PlannerForm
				submitLabel="Build my plan"
				submitting={compute.isPending}
				onSubmit={(args) => compute.mutate(args)}
			/>
			{compute.isPending && <Spinner className="py-8" />}
			{plan && (
				<>
					<Itinerary plan={plan} />
					<SignUpCTA />
				</>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Authenticated: stored plan by default, recalculate to personalize + overwrite.
// ---------------------------------------------------------------------------
function AuthedPlanner() {
	const { data: user, isLoading: userLoading } = useUser();
	const prefsQuery = useNotificationPreferences();
	const prefs = prefsQuery.data;
	const stored = usePlanner();
	const compute = usePlannerCompute();

	// Both must settle before mounting the form so its one-time prefill is
	// correct (the form seeds state from these props on mount).
	if (userLoading || prefsQuery.isLoading || !user)
		return <Spinner className="py-12" />;

	// Show the freshest recalc result, falling back to the stored weekly plan.
	const plan =
		compute.data?.plan ??
		(stored.data?.status === "ready" ? stored.data.plan : undefined);

	const initialLocation: LocationValue | null =
		user.DefaultLatitude != null && user.DefaultLongitude != null
			? {
					lat: user.DefaultLatitude,
					lng: user.DefaultLongitude,
					name: "Your saved location",
				}
			: null;

	return (
		<div className="space-y-6">
			<PlannerForm
				initialLocation={initialLocation}
				initialCategories={prefs?.preferred_categories ?? []}
				initialRadius={user.DefaultRadiusMiles ?? 25}
				submitLabel="Recalculate"
				submitting={compute.isPending}
				onSubmit={(args) => compute.mutate(args)}
			/>

			{(stored.isLoading || compute.isPending) && <Spinner className="py-8" />}

			{plan ? (
				<Itinerary plan={plan} />
			) : (
				!stored.isLoading && (
					<p className="rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center text-(--sea-ink-soft)">
						No plan yet — set your location above and hit Recalculate to build
						one.
					</p>
				)
			)}

			{prefs && !prefs.email_enabled && <EnableDigestCTA />}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
interface PlannerFormProps {
	initialLocation?: LocationValue | null;
	initialCategories?: string[];
	initialRadius?: number;
	submitLabel: string;
	submitting: boolean;
	onSubmit: (args: PlannerComputeArgs) => void;
}

function PlannerForm({
	initialLocation = null,
	initialCategories = [],
	initialRadius = 25,
	submitLabel,
	submitting,
	onSubmit,
}: PlannerFormProps) {
	const [location, setLocation] = useState<LocationValue | null>(
		initialLocation,
	);
	const [categories, setCategories] = useState<string[]>(initialCategories);
	const [radius, setRadius] = useState<number>(initialRadius);

	const toggleCategory = (c: string) =>
		setCategories((prev) =>
			prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
		);

	const submit = () => {
		if (!location) return;
		onSubmit({ lat: location.lat, lng: location.lng, radius, categories });
	};

	return (
		<div className="space-y-4 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<LocationPicker
				value={location}
				onChange={setLocation}
				label="Where are you?"
				initialLat={initialLocation?.lat ?? null}
				initialLng={initialLocation?.lng ?? null}
			/>

			<div>
				<span className="mb-1.5 block text-sm font-medium text-(--sea-ink)">
					Interests <span className="text-(--sea-ink-soft)">(optional)</span>
				</span>
				<div className="flex flex-wrap gap-2">
					{CATEGORIES.map((c) => {
						const active = categories.includes(c);
						return (
							<button
								key={c}
								type="button"
								onClick={() => toggleCategory(c)}
								aria-pressed={active}
								className={`rounded-full border px-3 py-1 text-sm transition ${
									active
										? "border-(--lagoon-deep) bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)"
										: "border-(--line) text-(--sea-ink-soft) hover:border-(--lagoon)"
								}`}
							>
								{c}
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex flex-wrap items-end gap-4">
				<label className="text-sm">
					<span className="mb-1.5 block font-medium text-(--sea-ink)">
						Within
					</span>
					<select
						value={radius}
						onChange={(e) => setRadius(Number(e.target.value))}
						className="rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm text-(--sea-ink)"
					>
						{RADIUS_OPTIONS.map((r) => (
							<option key={r} value={r}>
								{r} miles
							</option>
						))}
					</select>
				</label>

				<button
					type="button"
					onClick={submit}
					disabled={!location || submitting}
					className="ml-auto rounded-md bg-(--lagoon-deep) px-5 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon) disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? "Building…" : submitLabel}
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Funnel CTAs
// ---------------------------------------------------------------------------
function SignUpCTA() {
	return (
		<div className="rounded-lg border border-(--lagoon-deep) bg-[rgba(79,184,178,0.08)] p-6 text-center">
			<h3 className="text-lg font-bold text-(--sea-ink)">
				Get this in your inbox every week
			</h3>
			<p className="mx-auto mt-1 max-w-md text-sm text-(--sea-ink-soft)">
				Create a free account and we'll email you a fresh, personalized
				itinerary every Friday — tuned to the events you save.
			</p>
			<SignUpButton mode="modal">
				<button
					type="button"
					className="mt-4 rounded-md bg-(--lagoon-deep) px-5 py-2 text-sm font-semibold text-white! shadow-sm hover:bg-(--lagoon)"
				>
					Sign up free
				</button>
			</SignUpButton>
		</div>
	);
}

function EnableDigestCTA() {
	return (
		<div className="rounded-lg border border-(--lagoon-deep) bg-[rgba(79,184,178,0.08)] p-6 text-center">
			<h3 className="text-lg font-bold text-(--sea-ink)">
				Never check manually again
			</h3>
			<p className="mx-auto mt-1 max-w-md text-sm text-(--sea-ink-soft)">
				Turn on the weekly email digest and we'll deliver your itinerary to your
				inbox every Friday automatically.
			</p>
			<Link
				to="/profile"
				search={{ tab: "settings" }}
				className="mt-4 inline-block rounded-md bg-(--lagoon-deep) px-5 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
			>
				Enable weekly email digest
			</Link>
		</div>
	);
}

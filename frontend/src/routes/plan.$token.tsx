import { createFileRoute, Link } from "@tanstack/react-router";
import { Itinerary } from "#/components/planner/Itinerary";
import { Spinner } from "#/components/Spinner";
import { useSharedPlan } from "#/lib/hooks/usePlanner";

export const Route = createFileRoute("/plan/$token")({
	component: SharedPlanPage,
});

function SharedPlanPage() {
	const { token } = Route.useParams();
	const { data, isLoading, isError } = useSharedPlan(token);

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="mb-6">
				<h1 className="text-2xl font-bold text-(--sea-ink)">
					A Shared Itinerary
				</h1>
				<p className="mt-1 text-sm text-(--sea-ink-soft)">
					Someone shared this plan of events with you.
				</p>
			</header>

			{isLoading ? (
				<Spinner className="py-12" />
			) : isError || !data?.plan ? (
				<NotFound />
			) : (
				<div className="space-y-6">
					<Itinerary plan={data.plan} readOnly />
					<BuildYourOwnCTA />
				</div>
			)}
		</div>
	);
}

function NotFound() {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-8 text-center">
			<p className="text-(--sea-ink-soft)">
				This shared plan couldn't be found — the link may be invalid or have
				expired.
			</p>
			<Link
				to="/planner"
				className="mt-5 inline-block rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
			>
				Build your own plan
			</Link>
		</div>
	);
}

function BuildYourOwnCTA() {
	return (
		<div className="rounded-lg border border-(--lagoon-deep) bg-[rgba(79,184,178,0.08)] p-6 text-center">
			<h3 className="text-lg font-bold text-(--sea-ink)">Want your own?</h3>
			<p className="mx-auto mt-1 max-w-md text-sm text-(--sea-ink-soft)">
				Build a personalized weekly itinerary of events near you on 919Events.
			</p>
			<Link
				to="/planner"
				className="mt-4 inline-block rounded-md bg-(--lagoon-deep) px-5 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
			>
				Build your plan
			</Link>
		</div>
	);
}

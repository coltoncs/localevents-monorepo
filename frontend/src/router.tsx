import {
	createRouter as createTanStackRouter,
	Link,
} from "@tanstack/react-router";
import { Spinner } from "./components/Spinner";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

function NotFound() {
	return (
		<div className="mx-auto max-w-md px-4 py-24 text-center">
			<h1 className="text-6xl font-bold text-(--lagoon-deep)">404</h1>
			<p className="mt-4 text-lg text-(--sea-ink)">Page not found.</p>
			<p className="mt-2 text-sm text-(--sea-ink-soft)">
				The page you're looking for doesn't exist or may have been removed.
			</p>
			<Link
				to="/"
				className="mt-6 inline-block rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
			>
				Back to Home
			</Link>
		</div>
	);
}

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,

		context: getContext(),

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPendingComponent: () => <Spinner className="py-24" />,
		defaultPendingMs: 200,
		defaultNotFoundComponent: NotFound,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

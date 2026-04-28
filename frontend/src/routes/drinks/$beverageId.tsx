import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/drinks/$beverageId")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/place/$placeId",
			params: { placeId: params.beverageId },
			replace: true,
		});
	},
});

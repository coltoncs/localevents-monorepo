import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/food/$foodId")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/place/$placeId",
			params: { placeId: params.foodId },
			replace: true,
		});
	},
});

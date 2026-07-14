import { useMutation } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";

export interface DigestSubscribeInput {
	email: string;
	latitude: number;
	longitude: number;
	radius_miles?: number;
	turnstile_token?: string;
}

// Public, unauthenticated email-digest signup for anonymous visitors.
// The backend responds 202 and mails a confirmation link (double opt-in).
export function useSubscribeToDigest() {
	return useMutation({
		mutationFn: (data: DigestSubscribeInput) =>
			apiClient<{ status: string }>("/api/subscribe", {
				method: "POST",
				body: JSON.stringify(data),
			}),
	});
}

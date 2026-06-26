import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "workers-og";
import { buildCardHtml, type CardData } from "#/lib/social-card";

const WIDTH = 1080;
const HEIGHT = 1350;

// Satori needs font data as ArrayBuffers (no system fonts). We fetch Inter from
// a CDN and lean on the Workers cache so repeated renders don't re-download.
const FONT_URLS = {
	regular:
		"https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
	semibold:
		"https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-600-normal.woff",
	bold: "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff",
};

async function loadFont(url: string): Promise<ArrayBuffer> {
	const res = await fetch(url, {
		cf: { cacheTtl: 86400, cacheEverything: true },
	} as RequestInit);
	if (!res.ok) throw new Error(`font fetch failed (${res.status}): ${url}`);
	return res.arrayBuffer();
}

// Fetch the background image and inline it as a data URL. Returns undefined if
// the image is missing (e.g. a city's branded background hasn't been uploaded
// yet) so the card still renders over the flat teal fallback.
//
// The fetch is cache-busted: backgrounds change (uploaded after first being
// referenced, or replaced), and a CDN-cached negative response (404 from before
// the image existed) or a stale image must never be served here.
async function resolveBackground(url?: string): Promise<string | undefined> {
	if (!url) return undefined;
	try {
		const bust = `${url}${url.includes("?") ? "&" : "?"}cb=${crypto.randomUUID()}`;
		const res = await fetch(bust, { cache: "no-store" });
		if (!res.ok) return undefined;
		const type = res.headers.get("content-type") || "image/jpeg";
		const buf = await res.arrayBuffer();
		// Convert to base64 in 32KB chunks. A naive per-byte string build is a
		// CPU hot spot (it can degrade to O(n²)) and isn't caught locally, where
		// the Worker CPU limit isn't enforced.
		const bytes = new Uint8Array(buf);
		let binary = "";
		const CHUNK = 0x8000;
		for (let i = 0; i < bytes.length; i += CHUNK) {
			binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
		}
		return `data:${type};base64,${btoa(binary)}`;
	} catch {
		return undefined;
	}
}

export const Route = createFileRoute("/render/social-card")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Server-to-server call from the Go generator; gate on a shared secret.
				const secret = process.env.SOCIAL_RENDER_SECRET;
				if (!secret || request.headers.get("x-render-secret") !== secret) {
					return new Response("forbidden", { status: 403 });
				}

				let data: CardData;
				try {
					data = (await request.json()) as CardData;
				} catch {
					return new Response("invalid JSON", { status: 400 });
				}
				if (!data?.heading || !Array.isArray(data.days)) {
					return new Response("missing heading or days", { status: 400 });
				}

				const [regular, semibold, bold, bgUrl] = await Promise.all([
					loadFont(FONT_URLS.regular),
					loadFont(FONT_URLS.semibold),
					loadFont(FONT_URLS.bold),
					resolveBackground(data.bgUrl),
				]);

				return new ImageResponse(buildCardHtml({ ...data, bgUrl }), {
					width: WIDTH,
					height: HEIGHT,
					fonts: [
						{ name: "Inter", data: regular, weight: 400, style: "normal" },
						{ name: "Inter", data: semibold, weight: 600, style: "normal" },
						{ name: "Inter", data: bold, weight: 700, style: "normal" },
					],
				});
			},
		},
	},
});

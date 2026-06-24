// Generates the service worker into dist/client AFTER `vite build`.
//
// Why this exists as a separate step: vite-plugin-pwa generates the web
// manifest and the `virtual:pwa-register` client module just fine, but it only
// emits the service worker from its `closeBundle` hook guarded by
// `!viteConfig.build.ssr`. TanStack Start drives the client + SSR builds
// through its own `buildApp` orchestration, so that branch never runs and no
// sw.js is produced. Running workbox-build directly against the finished client
// output is deterministic and independent of the build pipeline.
//
// The register module (see vite.config.ts) loads "/sw.js" at scope "/", so the
// dest filename must stay sw.js.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateSW } from "workbox-build";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "../dist/client");

const DAY = 24 * 60 * 60;

const { count, size, warnings } = await generateSW({
	globDirectory: clientDir,
	globPatterns: ["**/*.{js,css,svg,png,ico,woff,woff2,webmanifest}"],
	swDest: path.join(clientDir, "sw.js"),
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	skipWaiting: true,
	// Mapbox tiles, large fonts etc. can exceed the default 2 MiB precache cap.
	maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
	// Runtime caching makes the installed app fast and offline-capable. urlPattern
	// functions are inlined into sw.js by workbox-build, so they must be
	// self-contained (no outer-scope references).
	runtimeCaching: [
		{
			// Read API data. Matched by pathname so it works for both the
			// same-origin dev proxy and the cross-origin Railway API in prod.
			// NetworkFirst = always fresh when online, last-known copy when offline.
			urlPattern: ({ url, request }) =>
				request.method === "GET" && url.pathname.startsWith("/api/"),
			handler: "NetworkFirst",
			method: "GET",
			options: {
				cacheName: "api-data",
				networkTimeoutSeconds: 3,
				expiration: { maxEntries: 200, maxAgeSeconds: DAY },
				// Allow opaque (0) responses too in case CORS isn't present.
				cacheableResponse: { statuses: [0, 200] },
				matchOptions: { ignoreVary: true },
			},
		},
		{
			// Event/venue images (R2, etc.) — host-independent via destination.
			urlPattern: ({ request }) => request.destination === "image",
			handler: "CacheFirst",
			options: {
				cacheName: "images",
				expiration: {
					maxEntries: 200,
					maxAgeSeconds: 30 * DAY,
					purgeOnQuotaError: true,
				},
				cacheableResponse: { statuses: [0, 200] },
			},
		},
		{
			// Mapbox styles/sprites/fonts/tiles. Kept conservative (short expiry,
			// capped entries) — Mapbox ToS limits persistent tile caching.
			urlPattern: ({ url }) => url.hostname.endsWith("mapbox.com"),
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "mapbox",
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: DAY,
					purgeOnQuotaError: true,
				},
				cacheableResponse: { statuses: [0, 200] },
			},
		},
		{
			// SSR page documents. Lets the installed app reopen previously-visited
			// routes offline. Safe to cache because auth is resolved client-side
			// (Clerk), so the HTML itself is not user-specific.
			urlPattern: ({ request }) => request.mode === "navigate",
			handler: "NetworkFirst",
			options: {
				cacheName: "pages",
				networkTimeoutSeconds: 3,
				expiration: { maxEntries: 50, maxAgeSeconds: DAY },
				cacheableResponse: { statuses: [0, 200] },
			},
		},
	],
});

for (const warning of warnings) console.warn(warning);
console.log(
	`PWA service worker generated: precached ${count} files, ${(size / 1024 / 1024).toFixed(2)} MiB.`,
);

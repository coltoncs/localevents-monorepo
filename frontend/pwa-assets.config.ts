import {
	defineConfig,
	minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// Generates the full set of PWA icons from a single source image into `public/`.
// Run with `pnpm generate-pwa-assets` whenever the source logo changes.
//
// Source: public/favicon.png (1024x1024). Outputs:
//   pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
//   maskable-icon-512x512.png, apple-touch-icon-180x180.png, favicon.ico
export default defineConfig({
	headLinkOptions: { preset: "2023" },
	preset: minimal2023Preset,
	images: ["public/favicon.png"],
});

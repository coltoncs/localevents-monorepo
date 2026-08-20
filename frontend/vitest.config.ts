import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

// Kept separate from vite.config.ts: the app config loads the Cloudflare Workers
// plugin, which has no place in a jsdom unit-test run.
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{ find: /^#\//, replacement: `${src}/` },
			{ find: /^@\//, replacement: `${src}/` },
		],
	},
	test: {
		environment: "jsdom",
		globals: false,
		setupFiles: ["./src/test-setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
});

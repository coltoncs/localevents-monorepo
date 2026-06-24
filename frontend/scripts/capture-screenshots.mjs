// Captures PWA manifest screenshots (desktop "wide" + mobile narrow) so Chrome
// shows its richer install dialog. Defaults to the live site for real, populated
// content; override with SCREENSHOT_URL=http://localhost:3000 to use a local run.
//
// Run: pnpm capture-screenshots
// Output: public/screenshots/{desktop,mobile}.png (referenced from the manifest
// in vite.config.ts).

import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SCREENSHOT_URL ?? "https://919events.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/screenshots");

const shots = [
	{ name: "desktop", width: 1280, height: 800 },
	{ name: "mobile", width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

for (const { name, width, height } of shots) {
	// deviceScaleFactor 1 so the PNG pixel dimensions equal the viewport, which
	// must match the `sizes` declared for each screenshot in the manifest.
	const page = await browser.newPage({
		viewport: { width, height },
		deviceScaleFactor: 1,
	});
	await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
	// Settle any entrance animations before capturing.
	await page.waitForTimeout(2_000);
	const file = path.join(outDir, `${name}.png`);
	await page.screenshot({ path: file });
	console.log(`Captured ${name} (${width}x${height}) -> ${file}`);
	await page.close();
}

await browser.close();

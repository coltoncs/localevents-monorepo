import { render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Event } from "#/lib/types";

// The real module pulls in @mapbox/search-js-react; EventMap only needs the
// storage key and the SavedLocation type from it.
vi.mock("./LocationSearch", () => ({ STORAGE_KEY: "test-location" }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));

type Listener = (...args: unknown[]) => void;

// Minimal stand-in for mapbox-gl's Map: enough surface for EventMap, plus
// manual control over `isStyleLoaded()` and event dispatch so a test can drive
// the exact ordering of style.load / idle relative to a data arrival.
class FakeMap {
	styleLoaded = false;
	sources = new Map<string, { data: unknown }>();
	layers = new Set<string>();
	listeners: Array<{ type: string; layer?: string; fn: Listener }> = [];

	on(type: string, layerOrFn: string | Listener, fn?: Listener) {
		if (typeof layerOrFn === "string")
			this.listeners.push({ type, layer: layerOrFn, fn: fn as Listener });
		else this.listeners.push({ type, fn: layerOrFn });
	}
	once(type: string, layerOrFn: string | Listener, fn?: Listener) {
		const handler = (
			typeof layerOrFn === "string" ? fn : layerOrFn
		) as Listener;
		const wrapped: Listener = (...args) => {
			this.off(type, wrapped);
			handler(...args);
		};
		// Keep a link back so `off(type, handler)` also removes the wrapper, the
		// way mapbox-gl's own once/off pairing behaves.
		(wrapped as Listener & { original?: Listener }).original = handler;
		this.on(type, wrapped);
	}
	off(type: string, fn: Listener) {
		this.listeners = this.listeners.filter(
			(l) =>
				!(
					l.type === type &&
					(l.fn === fn ||
						(l.fn as Listener & { original?: Listener }).original === fn)
				),
		);
	}
	fire(type: string) {
		for (const l of [...this.listeners]) if (l.type === type) l.fn({});
	}

	isStyleLoaded() {
		return this.styleLoaded;
	}
	addSource(id: string, cfg: { data: unknown }) {
		if (this.sources.has(id)) throw new Error(`source exists: ${id}`);
		const entry = {
			data: cfg.data,
			setData: (d: unknown) => {
				entry.data = d;
			},
		};
		this.sources.set(id, entry);
	}
	getSource(id: string) {
		return this.sources.get(id);
	}
	addLayer(layer: { id: string }) {
		this.layers.add(layer.id);
	}
	getLayer(id: string) {
		return this.layers.has(id) ? { id } : undefined;
	}
	setPaintProperty() {}
	setConfigProperty() {}
	setCenter() {}
	fitBounds() {}
	flyTo() {}
	easeTo() {}
	getZoom() {
		return 11;
	}
	getCanvas() {
		return { style: {} } as unknown as HTMLCanvasElement;
	}
	addControl() {}
	queryRenderedFeatures() {
		return [];
	}
	resize() {}
	loaded() {
		return true;
	}
	remove() {}
}

let lastMap: FakeMap;

vi.mock("mapbox-gl", () => {
	class Popup {
		setLngLat() {
			return this;
		}
		setHTML() {
			return this;
		}
		addTo() {
			return this;
		}
		remove() {}
	}
	class LngLatBounds {
		extend() {
			return this;
		}
	}
	class GeolocateControl {
		on() {}
	}
	return {
		default: {
			accessToken: "",
			Map: class {
				constructor() {
					lastMap = new FakeMap();
					// biome-ignore lint/correctness/noConstructorReturn: test double
					return lastMap as unknown as object;
				}
			},
			Popup,
			LngLatBounds,
			GeolocateControl,
		},
	};
});

function makeEvents(n: number): Event[] {
	return Array.from({ length: n }, (_, i) => ({
		ID: `evt-${i}`,
		Title: `Event ${i}`,
		StartTime: "2026-08-20T18:00:00Z",
		Longitude: -78.6 - i * 0.01,
		Latitude: 35.7 + i * 0.01,
	})) as unknown as Event[];
}

function featureCount(map: FakeMap): number {
	const src = map.getSource("events") as { data?: { features?: unknown[] } };
	return src?.data?.features?.length ?? -1;
}

describe("EventMap event source", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	// Regression: a deferred `once("idle")` update queued while the events list
	// was still empty must not overwrite a newer, non-empty update that already
	// landed. Before the fix this left the source at 0 features, so the map
	// rendered no markers even though the sidebar listed events.
	test("a late idle does not blank markers that already rendered", async () => {
		const { EventMap } = await import("./EventMap");
		const center = { lat: 35.78, lng: -78.64 };

		// First render: no events yet. The style is not loaded, so this update is
		// deferred to `idle`.
		const { rerender } = render(
			<EventMap events={[]} center={center} radiusMiles={25} />,
		);
		const map = lastMap;
		expect(map).toBeTruthy();

		// The basemap resolves and the layers get created (still empty).
		map.fire("style.load");
		expect(featureCount(map)).toBe(0);

		// Events arrive after the style is usable, so this update applies at once.
		map.styleLoaded = true;
		rerender(
			<EventMap events={makeEvents(20)} center={center} radiusMiles={25} />,
		);
		expect(featureCount(map)).toBe(20);

		// The map finally settles. Any update deferred from the empty render is
		// now stale and must not win.
		map.fire("idle");
		expect(featureCount(map)).toBe(20);
	});

	test("a deferred update applies once the map settles", async () => {
		const { EventMap } = await import("./EventMap");
		const center = { lat: 35.78, lng: -78.64 };

		const { rerender } = render(
			<EventMap events={[]} center={center} radiusMiles={25} />,
		);
		const map = lastMap;
		map.fire("style.load");

		// Style still not loaded when the data lands: the update must be deferred
		// and then applied on the next `idle`, not dropped.
		rerender(
			<EventMap events={makeEvents(5)} center={center} radiusMiles={25} />,
		);
		expect(featureCount(map)).toBe(0);
		map.fire("idle");
		expect(featureCount(map)).toBe(5);
	});
});

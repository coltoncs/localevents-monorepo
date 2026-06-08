import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "@tanstack/react-router";
import {
	createGeoJSONCircle,
	escapeHtml,
	getCircleColors as getCircleColorsUtil,
	getEventMarkerStyle as getEventMarkerStyleUtil,
	getLightPreset,
	getResolvedTheme,
	STANDARD_SLOT_MIDDLE,
	STANDARD_STYLE,
} from "#/lib/mapUtils";
import type { Event } from "#/lib/types";
import { type SavedLocation, STORAGE_KEY } from "./LocationSearch";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

const EVENTS_SOURCE = "events";
const CLUSTER_LAYER = "event-clusters";
const CLUSTER_COUNT_LAYER = "event-cluster-count";
const POINT_LAYER = "event-points";
const POINT_COUNT_LAYER = "event-point-count";

// Two events count as the same spot once their coordinates match at this
// precision (~1m). They can never be separated by zoom, so they share a marker.
const COORD_PRECISION = 5;

function coordKey(lng: number, lat: number): string {
	return `${lng.toFixed(COORD_PRECISION)},${lat.toFixed(COORD_PRECISION)}`;
}

// A trimmed event shape carried in marker popups (serialized into GeoJSON
// feature properties, which only hold primitives).
interface PopupEvent {
	id: string;
	title: string;
	start: string;
	venue: string;
	image: string;
}

function toPopupEvent(e: Event): PopupEvent {
	return {
		id: e.ID,
		title: e.Title,
		start: e.StartTime,
		venue: e.VenueName ?? "",
		image: e.ImageUrl ?? "",
	};
}

// Group events by coordinate so co-located events become one feature carrying
// the whole list. `count` feeds the cluster total; `events` feeds the popup.
function buildEventFeatures(
	events: Event[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
	const groups = new Map<string, Event[]>();
	for (const e of events) {
		if (typeof e.Longitude !== "number" || typeof e.Latitude !== "number")
			continue;
		const key = coordKey(e.Longitude, e.Latitude);
		const existing = groups.get(key);
		if (existing) existing.push(e);
		else groups.set(key, [e]);
	}

	const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
	for (const group of groups.values()) {
		const first = group[0];
		features.push({
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [first.Longitude, first.Latitude],
			},
			properties: {
				count: group.length,
				events: JSON.stringify(group.map(toPopupEvent)),
			},
		});
	}
	return { type: "FeatureCollection", features };
}

const formatPopupTime = (iso: string) =>
	Intl.DateTimeFormat("en-US", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(iso));

// Popup for a single event — keeps the original card layout.
function singleEventHtml(e: PopupEvent): string {
	return `<div class="map-popup-content">
    <strong>${escapeHtml(e.title)}</strong>
    ${e.image ? `<img src="${escapeHtml(e.image)}" alt="${escapeHtml(e.title)}" loading="lazy" decoding="async">` : ""}
    <p>${formatPopupTime(e.start)}</p>
    ${e.venue ? `<p>${escapeHtml(e.venue)}</p>` : ""}
    <a href="/events/${encodeURIComponent(e.id)}">View Details</a>
  </div>`;
}

// Popup for several events sharing one location — a scrollable list so every
// event at the venue is reachable, not just whichever marker landed on top.
function multiEventHtml(events: PopupEvent[]): string {
	const items = events
		.map(
			(
				e,
			) => `<a class="map-popup-item" href="/events/${encodeURIComponent(e.id)}">
        ${
					e.image
						? `<img src="${escapeHtml(e.image)}" alt="" loading="lazy" decoding="async">`
						: `<span class="map-popup-item-thumb" aria-hidden="true"></span>`
				}
        <span class="map-popup-item-body">
          <strong>${escapeHtml(e.title)}</strong>
          <span>${formatPopupTime(e.start)}</span>
          ${e.venue ? `<span>${escapeHtml(e.venue)}</span>` : ""}
        </span>
      </a>`,
		)
		.join("");
	return `<div class="map-popup-content map-popup-list">
    <div class="map-popup-list-header">${events.length} events here</div>
    <div class="map-popup-list-items">${items}</div>
  </div>`;
}

function popupHtml(events: PopupEvent[]): string {
	return events.length === 1
		? singleEventHtml(events[0])
		: multiEventHtml(events);
}

function saveLocation(location: SavedLocation) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
	} catch {
		// storage full or unavailable
	}
}

interface EventMapProps {
	events: Event[];
	center: { lat: number; lng: number };
	radiusMiles?: number;
	zoom?: number;
	className?: string;
	onMapReady?: (map: mapboxgl.Map) => void;
	onMapClick?: (lngLat: { lng: number; lat: number }) => void;
	selectedEventId?: string | null;
}

export function EventMap({
	events,
	center,
	radiusMiles = 10,
	zoom = 11,
	className = "h-[500px] w-full rounded-lg",
	onMapReady,
	onMapClick,
	selectedEventId,
}: EventMapProps) {
	const navigate = useNavigate();
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const themeRef = useRef<"light" | "dark">(getResolvedTheme());
	const eventsRef = useRef<Event[]>(events);
	eventsRef.current = events;
	// The popup opened when an event is selected from the list, tracked so it can
	// be replaced/closed as the selection changes.
	const selectionPopupRef = useRef<mapboxgl.Popup | null>(null);
	// The popup opened by clicking a marker on the map, tracked so it can be
	// closed when the events change (e.g. on a date/filter change).
	const pointPopupRef = useRef<mapboxgl.Popup | null>(null);
	const onMapClickRef = useRef(onMapClick);
	onMapClickRef.current = onMapClick;

	const getEventMarkerStyle = useCallback(getEventMarkerStyleUtil, []);
	const getCircleColors = useCallback(getCircleColorsUtil, []);

	// Add or update the radius circle on the map
	const updateRadiusCircle = useCallback(
		(map: mapboxgl.Map, lng: number, lat: number, miles: number) => {
			const geojson = createGeoJSONCircle(lng, lat, miles);
			const source = map.getSource(RADIUS_SOURCE) as
				| mapboxgl.GeoJSONSource
				| undefined;

			if (source) {
				source.setData(geojson);
			} else {
				map.addSource(RADIUS_SOURCE, { type: "geojson", data: geojson });

				const colors = getCircleColors(themeRef.current);

				map.addLayer({
					id: RADIUS_FILL_LAYER,
					type: "fill",
					slot: STANDARD_SLOT_MIDDLE,
					source: RADIUS_SOURCE,
					paint: { "fill-color": colors.fill },
				});

				map.addLayer({
					id: RADIUS_LINE_LAYER,
					type: "line",
					slot: STANDARD_SLOT_MIDDLE,
					source: RADIUS_SOURCE,
					paint: {
						"line-color": colors.stroke,
						"line-width": 2,
						"line-dasharray": [4, 3],
					},
				});
			}
		},
		[getCircleColors],
	);

	// Update circle colors for current theme
	const updateCircleColors = useCallback(
		(map: mapboxgl.Map, theme: "light" | "dark") => {
			const colors = getCircleColors(theme);
			if (map.getLayer(RADIUS_FILL_LAYER)) {
				map.setPaintProperty(RADIUS_FILL_LAYER, "fill-color", colors.fill);
			}
			if (map.getLayer(RADIUS_LINE_LAYER)) {
				map.setPaintProperty(RADIUS_LINE_LAYER, "line-color", colors.stroke);
			}
		},
		[getCircleColors],
	);

	// Create the clustered events source, its layers, and the interaction
	// handlers. Runs once per map (guarded by the source's existence).
	const addEventLayers = useCallback(
		(map: mapboxgl.Map, data: GeoJSON.FeatureCollection<GeoJSON.Point>) => {
			// Read the theme fresh so the colors are correct even if the layers are
			// created before a theme-change event has fired.
			const style = getEventMarkerStyle(getResolvedTheme());

			map.addSource(EVENTS_SOURCE, {
				type: "geojson",
				data,
				cluster: true,
				clusterRadius: 50,
				clusterMaxZoom: 14,
				// Sum the per-location event counts so a cluster label reflects the
				// number of events, not the number of distinct map points.
				clusterProperties: { eventCount: ["+", ["get", "count"]] },
			});

			// No slot: append above the whole basemap so markers stay on top of
			// 3D building extrusions (the "middle" slot renders beneath them).
			map.addLayer({
				id: CLUSTER_LAYER,
				type: "circle",
				source: EVENTS_SOURCE,
				filter: ["has", "point_count"],
				paint: {
					"circle-color": style.fill,
					// Render at full color regardless of the Standard style's
					// time-of-day lighting (otherwise the night preset blackens it).
					"circle-emissive-strength": 1,
					"circle-stroke-width": 2,
					"circle-stroke-color": style.stroke,
					"circle-radius": ["step", ["get", "eventCount"], 17, 10, 23, 50, 31],
				},
			});

			map.addLayer({
				id: CLUSTER_COUNT_LAYER,
				type: "symbol",
				source: EVENTS_SOURCE,
				filter: ["has", "point_count"],
				layout: {
					"text-field": ["to-string", ["get", "eventCount"]],
					"text-size": 13,
				},
				paint: { "text-color": style.text, "text-emissive-strength": 1 },
			});

			map.addLayer({
				id: POINT_LAYER,
				type: "circle",
				source: EVENTS_SOURCE,
				filter: ["!", ["has", "point_count"]],
				paint: {
					"circle-color": style.fill,
					"circle-emissive-strength": 1,
					"circle-radius": 13,
					"circle-stroke-width": 2.5,
					"circle-stroke-color": style.stroke,
				},
			});

			// Badge showing the event count on locations holding more than one event.
			map.addLayer({
				id: POINT_COUNT_LAYER,
				type: "symbol",
				source: EVENTS_SOURCE,
				filter: ["!", ["has", "point_count"]],
				layout: {
					"text-field": [
						"case",
						[">", ["get", "count"], 1],
						["to-string", ["get", "count"]],
						"",
					],
					"text-size": 11,
					"text-allow-overlap": true,
				},
				paint: { "text-color": style.text, "text-emissive-strength": 1 },
			});

			// Clicking a cluster zooms to the level where it breaks apart.
			map.on("click", CLUSTER_LAYER, (e) => {
				const feature = map.queryRenderedFeatures(e.point, {
					layers: [CLUSTER_LAYER],
				})[0];
				if (!feature) return;
				const clusterId = feature.properties?.cluster_id as number;
				const source = map.getSource(EVENTS_SOURCE) as mapboxgl.GeoJSONSource;
				source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
					if (err) return;
					map.easeTo({
						center: (feature.geometry as GeoJSON.Point).coordinates as [
							number,
							number,
						],
						zoom: expansionZoom ?? map.getZoom() + 2,
						duration: 600,
					});
				});
			});

			// Clicking a point opens its popup — a single card or, when several
			// events share the spot, a scrollable list of all of them.
			map.on("click", POINT_LAYER, (e) => {
				const feature = e.features?.[0];
				if (!feature) return;
				const coordinates = (
					feature.geometry as GeoJSON.Point
				).coordinates.slice() as [number, number];
				let list: PopupEvent[];
				try {
					list = JSON.parse(feature.properties?.events as string);
				} catch {
					return;
				}
				pointPopupRef.current?.remove();
				pointPopupRef.current = new mapboxgl.Popup({
					offset: 16,
					className: "themed-popup",
					maxWidth: "280px",
				})
					.setLngLat(coordinates)
					.setHTML(popupHtml(list))
					.addTo(map);
			});

			for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
				map.on("mouseenter", layer, () => {
					map.getCanvas().style.cursor = "pointer";
				});
				map.on("mouseleave", layer, () => {
					map.getCanvas().style.cursor = "";
				});
			}
		},
		[getEventMarkerStyle],
	);

	// Initialize map
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;

		themeRef.current = getResolvedTheme();

		mapRef.current = new mapboxgl.Map({
			container: containerRef.current,
			style: STANDARD_STYLE,
			center: [center.lng, center.lat],
			zoom,
		});

		const initialTheme = themeRef.current;
		mapRef.current.on("style.load", () => {
			mapRef.current?.setConfigProperty(
				"basemap",
				"lightPreset",
				getLightPreset(initialTheme),
			);
		});

		const geolocate = new mapboxgl.GeolocateControl({
			positionOptions: { enableHighAccuracy: true },
			trackUserLocation: false,
			showUserLocation: true,
		});

		mapRef.current.addControl(geolocate, "top-left");

		geolocate.on("geolocate", ({ coords }) => {
			const { latitude, longitude } = coords;
			saveLocation({ name: "My Location", lat: latitude, lng: longitude });
			navigate({
				to: location.pathname,
				search: (prev) => ({ ...prev, lat: latitude, lng: longitude }),
			});
		});

		mapRef.current.on("click", (e) => {
			onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
		});

		// Add radius circle once the style is loaded
		mapRef.current.on("load", () => {
			updateRadiusCircle(mapRef.current!, center.lng, center.lat, radiusMiles);
			onMapReady?.(mapRef.current!);
		});

		return () => {
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, []);

	// React to theme changes
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const applyTheme = (newTheme: "light" | "dark") => {
			if (newTheme === themeRef.current) return;
			themeRef.current = newTheme;

			map.setConfigProperty("basemap", "lightPreset", getLightPreset(newTheme));
			updateCircleColors(map, newTheme);

			const style = getEventMarkerStyle(newTheme);
			if (map.getLayer(CLUSTER_LAYER)) {
				map.setPaintProperty(CLUSTER_LAYER, "circle-color", style.fill);
				map.setPaintProperty(
					CLUSTER_LAYER,
					"circle-stroke-color",
					style.stroke,
				);
			}
			if (map.getLayer(CLUSTER_COUNT_LAYER))
				map.setPaintProperty(CLUSTER_COUNT_LAYER, "text-color", style.text);
			if (map.getLayer(POINT_LAYER)) {
				map.setPaintProperty(POINT_LAYER, "circle-color", style.fill);
				map.setPaintProperty(POINT_LAYER, "circle-stroke-color", style.stroke);
			}
			if (map.getLayer(POINT_COUNT_LAYER))
				map.setPaintProperty(POINT_COUNT_LAYER, "text-color", style.text);
		};

		const observer = new MutationObserver(() => applyTheme(getResolvedTheme()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "class"],
		});

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleMediaChange = () => applyTheme(getResolvedTheme());
		mediaQuery.addEventListener("change", handleMediaChange);

		return () => {
			observer.disconnect();
			mediaQuery.removeEventListener("change", handleMediaChange);
		};
	}, [getEventMarkerStyle, updateCircleColors]);

	// Update center and radius circle
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.setCenter([center.lng, center.lat]);

		if (map.isStyleLoaded()) {
			updateRadiusCircle(map, center.lng, center.lat, radiusMiles);
		} else {
			map.once("style.load", () => {
				updateRadiusCircle(map, center.lng, center.lat, radiusMiles);
			});
		}
	}, [center.lat, center.lng, radiusMiles, updateRadiusCircle]);

	// Update the clustered events source (creating it on first run)
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		// The event set changed (date/filter change or refetch) — close any
		// marker popup so it can't linger over a now-stale location.
		pointPopupRef.current?.remove();
		pointPopupRef.current = null;

		const data = buildEventFeatures(events);

		const apply = () => {
			const source = map.getSource(EVENTS_SOURCE) as
				| mapboxgl.GeoJSONSource
				| undefined;
			if (source) source.setData(data);
			else addEventLayers(map, data);

			// Fit map to show all events + the center point
			if (events.length > 0) {
				const bounds = new mapboxgl.LngLatBounds();
				bounds.extend([center.lng, center.lat]);
				events.forEach((event) =>
					bounds.extend([event.Longitude, event.Latitude]),
				);
				map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
			}
		};

		if (map.isStyleLoaded()) apply();
		else map.once("load", apply);
	}, [events, addEventLayers, center.lat, center.lng]);

	// Respond to external selection: open a popup at the selected event's
	// location (listing every co-located event), replacing any prior one.
	useEffect(() => {
		selectionPopupRef.current?.remove();
		selectionPopupRef.current = null;

		const map = mapRef.current;
		if (!map || !selectedEventId) return;

		const selected = eventsRef.current.find((e) => e.ID === selectedEventId);
		if (!selected) return;

		const key = coordKey(selected.Longitude, selected.Latitude);
		const colocated = eventsRef.current.filter(
			(e) => coordKey(e.Longitude, e.Latitude) === key,
		);

		selectionPopupRef.current = new mapboxgl.Popup({
			offset: 16,
			className: "themed-popup",
			maxWidth: "280px",
		})
			.setLngLat([selected.Longitude, selected.Latitude])
			.setHTML(popupHtml(colocated.map(toPopupEvent)))
			.addTo(map);
	}, [selectedEventId]);

	return <div ref={containerRef} className={className} />;
}

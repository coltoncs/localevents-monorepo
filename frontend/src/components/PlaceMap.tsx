import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef } from "react";
import { formatCuisineLabel } from "#/lib/cuisines";
import {
	createGeoJSONCircle,
	escapeHtml,
	getCircleColors as getCircleColorsUtil,
	getMarkerColor as getDrinkMarkerColor,
	getLightPreset,
	getResolvedTheme,
	STANDARD_SLOT_MIDDLE,
	STANDARD_STYLE,
} from "#/lib/mapUtils";
import type { Place } from "#/lib/types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

const PIN_BODY = `<path d="M15 0C6.716 0 0 6.716 0 15c0 10 15 25 15 25s15-15 15-25C30 6.716 23.284 0 15 0Z" fill="currentColor"/>`;
const BEER_ICON = `<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5C9.44 3.5 10 3 11 3s1.56.5 3 .5 2.72-.5 3.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>`;
const MARTINI_ICON = `<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>`;
const FORK_KNIFE_ICON = `<path d="M3 2v7c0 1.1.9 2 2 2h1v9h2v-9h1c1.1 0 2-.9 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`;

const POPUP_OFFSET: { [k: string]: [number, number] } = {
	center: [0, 0],
	top: [0, 0],
	"top-left": [0, 0],
	"top-right": [0, 0],
	bottom: [0, -40],
	"bottom-left": [0, -40],
	"bottom-right": [0, -40],
	left: [15, -20],
	right: [-15, -20],
};

function foodMarkerColor(theme: "light" | "dark"): string {
	return theme === "dark" ? "#f59e0b" : "#d97706";
}

function pickMarkerStyle(
	place: Place,
	theme: "light" | "dark",
): { color: string; icon: string } {
	if (place.IsFood && place.IsDrink) {
		return {
			color: foodMarkerColor(theme),
			icon: place.BarType === "bar" ? MARTINI_ICON : BEER_ICON,
		};
	}
	if (place.IsDrink) {
		return {
			color: getDrinkMarkerColor(theme),
			icon: place.BarType === "bar" ? MARTINI_ICON : BEER_ICON,
		};
	}
	return { color: foodMarkerColor(theme), icon: FORK_KNIFE_ICON };
}

function createPlaceMarker(
	place: Place,
	theme: "light" | "dark",
): HTMLDivElement {
	const { color, icon } = pickMarkerStyle(place, theme);
	const el = document.createElement("div");
	el.style.color = color;
	el.style.cursor = "pointer";
	el.style.width = "30px";
	el.style.height = "40px";
	el.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.25))";
	el.innerHTML = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">${PIN_BODY}<svg x="5" y="5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></svg>`;
	return el;
}

function placeKindLabel(place: Place): string {
	const parts: string[] = [];
	if (place.IsFood && place.Cuisine)
		parts.push(formatCuisineLabel(place.Cuisine));
	if (place.IsDrink && place.BarType) {
		parts.push(place.BarType === "brewery" ? "Brewery" : "Bar");
	}
	return parts.join(" · ");
}

interface PlaceMapProps {
	places: Place[];
	center: { lat: number; lng: number };
	radiusMiles?: number;
	zoom?: number;
	className?: string;
	onMapReady?: (map: mapboxgl.Map) => void;
	onMapClick?: (lngLat: { lng: number; lat: number }) => void;
	selectedPlaceId?: string | null;
}

export function PlaceMap({
	places,
	center,
	radiusMiles = 10,
	zoom = 11,
	className = "h-[500px] w-full rounded-lg",
	onMapReady,
	onMapClick,
	selectedPlaceId,
}: PlaceMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
	const themeRef = useRef<"light" | "dark">(getResolvedTheme());
	const onMapClickRef = useRef(onMapClick);
	onMapClickRef.current = onMapClick;
	const selectedPlaceIdRef = useRef<string | null | undefined>(selectedPlaceId);
	selectedPlaceIdRef.current = selectedPlaceId;

	const getCircleColors = useCallback(getCircleColorsUtil, []);

	const updateRadiusCircle = useCallback(
		(map: mapboxgl.Map, lng: number, lat: number, miles: number) => {
			const source = map.getSource(RADIUS_SOURCE) as
				| mapboxgl.GeoJSONSource
				| undefined;

			if (miles <= 0) {
				if (map.getLayer(RADIUS_LINE_LAYER)) map.removeLayer(RADIUS_LINE_LAYER);
				if (map.getLayer(RADIUS_FILL_LAYER)) map.removeLayer(RADIUS_FILL_LAYER);
				if (source) map.removeSource(RADIUS_SOURCE);
				return;
			}

			const geojson = createGeoJSONCircle(lng, lat, miles);

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: map init runs once on mount
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

		mapRef.current.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				trackUserLocation: false,
				showUserLocation: true,
			}),
			"bottom-right",
		);

		mapRef.current.on("click", (e) => {
			onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
		});

		mapRef.current.on("load", () => {
			const map = mapRef.current;
			if (map) {
				updateRadiusCircle(map, center.lng, center.lat, radiusMiles);
				onMapReady?.(map);
			}
		});

		return () => {
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const applyTheme = (newTheme: "light" | "dark") => {
			if (newTheme === themeRef.current) return;
			themeRef.current = newTheme;
			map.setConfigProperty("basemap", "lightPreset", getLightPreset(newTheme));
			updateCircleColors(map, newTheme);

			// Recolor markers per place using the new theme
			const lookup = new Map(places.map((p) => [p.ID, p]));
			for (const [id, m] of Array.from(markersRef.current.entries())) {
				const place = lookup.get(id);
				if (!place) continue;
				m.getElement().style.color = pickMarkerStyle(place, newTheme).color;
			}
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
	}, [places, updateCircleColors]);

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

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		for (const m of markersRef.current.values()) m.remove();
		markersRef.current.clear();

		const theme = themeRef.current;

		for (const place of places) {
			const kindLabel = placeKindLabel(place);
			const popup = new mapboxgl.Popup({
				offset: POPUP_OFFSET,
				className: "themed-popup",
			}).setHTML(
				`<div class="map-popup-content">
          <strong>${escapeHtml(place.Name)}</strong>
          ${place.ImageUrl ? `<img src="${escapeHtml(place.ImageUrl)}" alt="${escapeHtml(place.Name)}" loading="lazy" decoding="async">` : ""}
          ${kindLabel ? `<p class="text-xs opacity-70">${escapeHtml(kindLabel)}</p>` : ""}
          ${place.Address ? `<p>${escapeHtml(place.Address)}</p>` : ""}
          <a href="/place/${encodeURIComponent(place.ID)}">View Details</a>
        </div>`,
			);

			const el = createPlaceMarker(place, theme);
			const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
				.setLngLat([place.Longitude, place.Latitude])
				.setPopup(popup)
				.addTo(map);

			el.addEventListener("click", () => {
				mapRef.current?.flyTo({
					center: [place.Longitude, place.Latitude],
					zoom: 14,
					duration: 1200,
				});
			});

			markersRef.current.set(place.ID, marker);
		}

		if (places.length > 0) {
			const bounds = new mapboxgl.LngLatBounds();
			bounds.extend([center.lng, center.lat]);
			for (const p of places) bounds.extend([p.Longitude, p.Latitude]);
			map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
		}

		const selId = selectedPlaceIdRef.current;
		if (selId) {
			const m = markersRef.current.get(selId);
			const popup = m?.getPopup();
			if (m && popup && !popup.isOpen()) m.togglePopup();
		}
	}, [places, center.lat, center.lng]);

	useEffect(() => {
		for (const m of markersRef.current.values()) {
			const popup = m.getPopup();
			if (popup?.isOpen()) popup.remove();
		}

		if (!selectedPlaceId) return;
		const marker = markersRef.current.get(selectedPlaceId);
		const popup = marker?.getPopup();
		if (marker && popup && !popup.isOpen()) marker.togglePopup();
	}, [selectedPlaceId]);

	return <div ref={containerRef} className={className} />;
}

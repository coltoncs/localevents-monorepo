import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef } from "react";
import {
	createGeoJSONCircle,
	escapeHtml,
	getCircleColors as getCircleColorsUtil,
	getLightPreset,
	getMarkerColor as getMarkerColorUtil,
	getResolvedTheme,
	STANDARD_SLOT_MIDDLE,
	STANDARD_STYLE,
} from "#/lib/mapUtils";
import type { Beverage } from "#/lib/types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

const PIN_BODY = `<path d="M15 0C6.716 0 0 6.716 0 15c0 10 15 25 15 25s15-15 15-25C30 6.716 23.284 0 15 0Z" fill="currentColor"/>`;

const BEER_ICON = `<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5C9.44 3.5 10 3 11 3s1.56.5 3 .5 2.72-.5 3.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>`;

const MARTINI_ICON = `<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>`;

function createBeverageMarkerElement(
	type: "brewery" | "bar",
	color: string,
): HTMLDivElement {
	const el = document.createElement("div");
	el.style.color = color;
	el.style.cursor = "pointer";
	el.style.width = "30px";
	el.style.height = "40px";
	el.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.25))";
	const icon = type === "brewery" ? BEER_ICON : MARTINI_ICON;
	el.innerHTML = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">${PIN_BODY}<svg x="5" y="5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></svg>`;
	return el;
}

interface BeverageMapProps {
	beverages: Beverage[];
	center: { lat: number; lng: number };
	radiusMiles?: number;
	zoom?: number;
	className?: string;
	onMapReady?: (map: mapboxgl.Map) => void;
	onMapClick?: (lngLat: { lng: number; lat: number }) => void;
	selectedBeverageId?: string | null;
}

export function BeverageMap({
	beverages,
	center,
	radiusMiles = 10,
	zoom = 11,
	className = "h-[500px] w-full rounded-lg",
	onMapReady,
	onMapClick,
	selectedBeverageId,
}: BeverageMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
	const themeRef = useRef<"light" | "dark">(getResolvedTheme());
	const onMapClickRef = useRef(onMapClick);
	onMapClickRef.current = onMapClick;
	const selectedBeverageIdRef = useRef<string | null | undefined>(selectedBeverageId);
	selectedBeverageIdRef.current = selectedBeverageId;

	const getMarkerColor = useCallback(getMarkerColorUtil, []);
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

	// Initialize map — intentionally empty deps to run once
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

	// React to theme changes
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const applyTheme = (newTheme: "light" | "dark") => {
			if (newTheme === themeRef.current) return;
			themeRef.current = newTheme;

			map.setConfigProperty(
				"basemap",
				"lightPreset",
				getLightPreset(newTheme),
			);
			updateCircleColors(map, newTheme);

			const color = getMarkerColor(newTheme);
			for (const m of markersRef.current.values()) {
				m.getElement().style.color = color;
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
	}, [getMarkerColor, updateCircleColors]);

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

	// Update markers
	useEffect(() => {
		if (!mapRef.current) return;

		markersRef.current.forEach((m) => m.remove());
		markersRef.current.clear();

		const theme = themeRef.current;
		const color = getMarkerColor(theme);

		beverages.forEach((bev) => {
			const typeLabel = bev.Type === "brewery" ? "Brewery" : "Bar";
			const popup = new mapboxgl.Popup({
				offset: 25,
				className: "themed-popup",
			}).setHTML(
				`<div class="map-popup-content">
          <strong>${escapeHtml(bev.Name)}</strong>
          ${bev.ImageUrl ? `<img src="${escapeHtml(bev.ImageUrl)}" alt="${escapeHtml(bev.Name)}" loading="lazy" decoding="async">` : ""}
          <p class="text-xs opacity-70">${typeLabel}</p>
          ${bev.Address ? `<p>${escapeHtml(bev.Address)}</p>` : ""}
          <a href="/drinks/${encodeURIComponent(bev.ID)}">View Details</a>
        </div>`,
			);

			const el = createBeverageMarkerElement(
				bev.Type === "brewery" ? "brewery" : "bar",
				color,
			);
			const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
				.setLngLat([bev.Longitude, bev.Latitude])
				.setPopup(popup)
				.addTo(mapRef.current!);

			el.addEventListener("click", () => {
				mapRef.current?.flyTo({
					center: [bev.Longitude, bev.Latitude],
					zoom: 14,
					duration: 1200,
				});
			});

			markersRef.current.set(bev.ID, marker);
		});

		if (beverages.length > 0 && mapRef.current) {
			const bounds = new mapboxgl.LngLatBounds();
			bounds.extend([center.lng, center.lat]);
			for (const bev of beverages) bounds.extend([bev.Longitude, bev.Latitude]);
			mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
		}

		const selId = selectedBeverageIdRef.current;
		if (selId) {
			const m = markersRef.current.get(selId);
			const popup = m?.getPopup();
			if (m && popup && !popup.isOpen()) m.togglePopup();
		}
	}, [beverages, getMarkerColor, center.lat, center.lng]);

	// Respond to external selection: open the matching marker's popup
	useEffect(() => {
		markersRef.current.forEach((m) => {
			const popup = m.getPopup();
			if (popup?.isOpen()) popup.remove();
		});

		if (!selectedBeverageId) return;
		const marker = markersRef.current.get(selectedBeverageId);
		const popup = marker?.getPopup();
		if (marker && popup && !popup.isOpen()) marker.togglePopup();
	}, [selectedBeverageId]);

	return <div ref={containerRef} className={className} />;
}

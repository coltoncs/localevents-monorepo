import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef } from "react";
import {
	createGeoJSONCircle,
	DARK_STYLE,
	getCircleColors as getCircleColorsUtil,
	getMarkerColor as getMarkerColorUtil,
	getResolvedTheme,
	LIGHT_STYLE,
} from "#/lib/mapUtils";
import type { Beverage } from "#/lib/types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

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

				const firstSymbolId = map
					.getStyle()
					.layers.find((l) => l.type === "symbol")?.id;

				map.addLayer(
					{
						id: RADIUS_FILL_LAYER,
						type: "fill",
						source: RADIUS_SOURCE,
						paint: { "fill-color": colors.fill },
					},
					firstSymbolId,
				);

				map.addLayer(
					{
						id: RADIUS_LINE_LAYER,
						type: "line",
						source: RADIUS_SOURCE,
						paint: {
							"line-color": colors.stroke,
							"line-width": 2,
							"line-dasharray": [4, 3],
						},
					},
					firstSymbolId,
				);
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
			style: themeRef.current === "dark" ? DARK_STYLE : LIGHT_STYLE,
			center: [center.lng, center.lat],
			zoom,
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

		const observer = new MutationObserver(() => {
			const newTheme = getResolvedTheme();
			if (newTheme !== themeRef.current) {
				themeRef.current = newTheme;
				map.setStyle(newTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);

				map.once("style.load", () => {
					updateRadiusCircle(map, center.lng, center.lat, radiusMiles);
					updateCircleColors(map, newTheme);

					const color = getMarkerColor(newTheme);
					for (const [id, m] of Array.from(markersRef.current.entries())) {
						const lngLat = m.getLngLat();
						const popup = m.getPopup();
						m.remove();
						const newMarker = new mapboxgl.Marker({ color })
							.setLngLat(lngLat)
							.setPopup(popup)
							.addTo(map);
						markersRef.current.set(id, newMarker);
					}
				});
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "class"],
		});

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleMediaChange = () => {
			const newTheme = getResolvedTheme();
			if (newTheme !== themeRef.current) {
				themeRef.current = newTheme;
				map.setStyle(newTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);
			}
		};
		mediaQuery.addEventListener("change", handleMediaChange);

		return () => {
			observer.disconnect();
			mediaQuery.removeEventListener("change", handleMediaChange);
		};
	}, [
		getMarkerColor,
		center.lng,
		center.lat,
		radiusMiles,
		updateRadiusCircle,
		updateCircleColors,
	]);

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
          <strong>${bev.Name}</strong>
          <p class="text-xs opacity-70">${typeLabel}</p>
          ${bev.Address ? `<p>${bev.Address}</p>` : ""}
          <a href="/drinks/${bev.ID}">View Details</a>
        </div>`,
			);

			const marker = new mapboxgl.Marker({ color })
				.setLngLat([bev.Longitude, bev.Latitude])
				.setPopup(popup)
				.addTo(mapRef.current!);

			const el = marker.getElement();
			el.style.cursor = "pointer";
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

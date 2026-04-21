import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef } from "react";
import { formatCuisineLabel } from "#/components/FoodCard";
import {
	createGeoJSONCircle,
	getCircleColors as getCircleColorsUtil,
	getLightPreset,
	getResolvedTheme,
	STANDARD_SLOT_MIDDLE,
	STANDARD_STYLE,
} from "#/lib/mapUtils";
import type { Food } from "#/lib/types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

// Warm palette for food markers (distinct from the lagoon hue used for drinks).
function getFoodMarkerColor(theme: "light" | "dark"): string {
	return theme === "dark" ? "#f59e0b" : "#d97706";
}

interface FoodMapProps {
	foods: Food[];
	center: { lat: number; lng: number };
	radiusMiles?: number;
	zoom?: number;
	className?: string;
	onMapReady?: (map: mapboxgl.Map) => void;
	onMapClick?: (lngLat: { lng: number; lat: number }) => void;
	selectedFoodId?: string | null;
}

export function FoodMap({
	foods,
	center,
	radiusMiles = 10,
	zoom = 11,
	className = "h-[500px] w-full rounded-lg",
	onMapReady,
	onMapClick,
	selectedFoodId,
}: FoodMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
	const themeRef = useRef<"light" | "dark">(getResolvedTheme());
	const onMapClickRef = useRef(onMapClick);
	onMapClickRef.current = onMapClick;
	const selectedFoodIdRef = useRef<string | null | undefined>(selectedFoodId);
	selectedFoodIdRef.current = selectedFoodId;

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

			map.setConfigProperty(
				"basemap",
				"lightPreset",
				getLightPreset(newTheme),
			);
			updateCircleColors(map, newTheme);

			const color = getFoodMarkerColor(newTheme);
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
	}, [updateCircleColors]);

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
		if (!mapRef.current) return;

		markersRef.current.forEach((m) => m.remove());
		markersRef.current.clear();

		const theme = themeRef.current;
		const color = getFoodMarkerColor(theme);

		foods.forEach((food) => {
			const cuisineLabel = formatCuisineLabel(food.Cuisine);
			const popup = new mapboxgl.Popup({
				offset: 25,
				className: "themed-popup",
			}).setHTML(
				`<div class="map-popup-content">
          <strong>${food.Name}</strong>
          <p class="text-xs opacity-70">${cuisineLabel}</p>
          ${food.Address ? `<p>${food.Address}</p>` : ""}
          <a href="/food/${food.ID}">View Details</a>
        </div>`,
			);

			const marker = new mapboxgl.Marker({ color })
				.setLngLat([food.Longitude, food.Latitude])
				.setPopup(popup)
				.addTo(mapRef.current!);

			const el = marker.getElement();
			el.style.cursor = "pointer";
			el.addEventListener("click", () => {
				mapRef.current?.flyTo({
					center: [food.Longitude, food.Latitude],
					zoom: 14,
					duration: 1200,
				});
			});

			markersRef.current.set(food.ID, marker);
		});

		if (foods.length > 0 && mapRef.current) {
			const bounds = new mapboxgl.LngLatBounds();
			bounds.extend([center.lng, center.lat]);
			for (const f of foods) bounds.extend([f.Longitude, f.Latitude]);
			mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
		}

		const selId = selectedFoodIdRef.current;
		if (selId) {
			const m = markersRef.current.get(selId);
			const popup = m?.getPopup();
			if (m && popup && !popup.isOpen()) m.togglePopup();
		}
	}, [foods, center.lat, center.lng]);

	useEffect(() => {
		markersRef.current.forEach((m) => {
			const popup = m.getPopup();
			if (popup?.isOpen()) popup.remove();
		});

		if (!selectedFoodId) return;
		const marker = markersRef.current.get(selectedFoodId);
		const popup = marker?.getPopup();
		if (marker && popup && !popup.isOpen()) marker.togglePopup();
	}, [selectedFoodId]);

	return <div ref={containerRef} className={className} />;
}

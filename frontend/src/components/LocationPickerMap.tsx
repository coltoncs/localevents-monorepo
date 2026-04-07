import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

// @ts-expect-error -- mapbox-gl-geocoder has no TS types for default import
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import {
	createGeoJSONCircle,
	DARK_STYLE,
	getCircleColors,
	getMarkerColor,
	getResolvedTheme,
	LIGHT_STYLE,
} from "#/lib/mapUtils";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

interface LocationPickerMapProps {
	lat: number;
	lng: number;
	onCoordinateChange: (lat: number, lng: number) => void;
	radiusMiles?: number;
	className?: string;
	interactive?: boolean;
}

export function LocationPickerMap({
	lat,
	lng,
	onCoordinateChange,
	radiusMiles,
	className = "h-[300px] w-full rounded-lg",
	interactive = true,
}: LocationPickerMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markerRef = useRef<mapboxgl.Marker | null>(null);
	const themeRef = useRef<"light" | "dark">(getResolvedTheme());
	const onChangeRef = useRef(onCoordinateChange);
	onChangeRef.current = onCoordinateChange;
	// Track whether the map is currently being updated by props to avoid feedback loops
	const updatingFromPropsRef = useRef(false);

	// Initialize map — intentionally empty deps to run once on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: map init runs once
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;

		themeRef.current = getResolvedTheme();
		const theme = themeRef.current;

		const map = new mapboxgl.Map({
			container: containerRef.current,
			style: theme === "dark" ? DARK_STYLE : LIGHT_STYLE,
			center: [lng, lat],
			zoom: 12,
		});
		mapRef.current = map;

		// Add draggable marker
		const marker = new mapboxgl.Marker({
			color: getMarkerColor(theme),
			draggable: interactive,
		})
			.setLngLat([lng, lat])
			.addTo(map);
		markerRef.current = marker;

		if (interactive) {
			marker.on("dragend", () => {
				const lngLat = marker.getLngLat();
				onChangeRef.current(lngLat.lat, lngLat.lng);
			});

			map.on("click", (e: mapboxgl.MapMouseEvent) => {
				marker.setLngLat(e.lngLat);
				onChangeRef.current(e.lngLat.lat, e.lngLat.lng);
			});

			// Add geocoder
			const geocoder = new MapboxGeocoder({
				accessToken: mapboxgl.accessToken,
				mapboxgl,
				marker: false,
				placeholder: "Search location...",
				types: "address,poi,place,locality,neighborhood",
			});
			map.addControl(geocoder, "top-left");

			geocoder.on("result", (e: { result: { center: [number, number] } }) => {
				const [gLng, gLat] = e.result.center;
				marker.setLngLat([gLng, gLat]);
				onChangeRef.current(gLat, gLng);
			});
		}

		// Add radius circle if needed
		if (radiusMiles) {
			map.on("load", () => {
				addRadiusCircle(map, lng, lat, radiusMiles, theme);
			});
		}

		return () => {
			map.remove();
			mapRef.current = null;
			markerRef.current = null;
		};
	}, []);

	// React to prop changes (parent updates lat/lng)
	useEffect(() => {
		const map = mapRef.current;
		const marker = markerRef.current;
		if (!map || !marker) return;

		const currentPos = marker.getLngLat();
		// Only update if coordinates actually changed (avoid loops from our own updates)
		if (
			Math.abs(currentPos.lat - lat) < 0.0001 &&
			Math.abs(currentPos.lng - lng) < 0.0001
		)
			return;

		updatingFromPropsRef.current = true;
		marker.setLngLat([lng, lat]);
		map.flyTo({ center: [lng, lat], duration: 500 });

		if (radiusMiles) {
			updateRadiusData(map, lng, lat, radiusMiles);
		}

		requestAnimationFrame(() => {
			updatingFromPropsRef.current = false;
		});
	}, [lat, lng, radiusMiles]);

	// Theme changes
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const observer = new MutationObserver(() => {
			const newTheme = getResolvedTheme();
			if (newTheme !== themeRef.current) {
				themeRef.current = newTheme;
				map.setStyle(newTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);

				map.once("style.load", () => {
					// Re-add marker with new color
					const marker = markerRef.current;
					if (marker) {
						const lngLat = marker.getLngLat();
						marker.remove();
						const newMarker = new mapboxgl.Marker({
							color: getMarkerColor(newTheme),
							draggable: interactive,
						})
							.setLngLat(lngLat)
							.addTo(map);
						markerRef.current = newMarker;

						if (interactive) {
							newMarker.on("dragend", () => {
								const pos = newMarker.getLngLat();
								onChangeRef.current(pos.lat, pos.lng);
							});
						}
					}

					// Re-add radius circle if needed
					if (radiusMiles) {
						addRadiusCircle(map, lng, lat, radiusMiles, newTheme);
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
	}, [interactive, radiusMiles, lat, lng]);

	return <div ref={containerRef} className={className} />;
}

function addRadiusCircle(
	map: mapboxgl.Map,
	lng: number,
	lat: number,
	radiusMiles: number,
	theme: "light" | "dark",
) {
	const geojson = createGeoJSONCircle(lng, lat, radiusMiles);
	const colors = getCircleColors(theme);

	if (map.getSource(RADIUS_SOURCE)) {
		(map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource).setData(geojson);
		return;
	}

	map.addSource(RADIUS_SOURCE, { type: "geojson", data: geojson });

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

function updateRadiusData(
	map: mapboxgl.Map,
	lng: number,
	lat: number,
	radiusMiles: number,
) {
	const source = map.getSource(RADIUS_SOURCE) as
		| mapboxgl.GeoJSONSource
		| undefined;
	if (source) {
		source.setData(createGeoJSONCircle(lng, lat, radiusMiles));
	}
}

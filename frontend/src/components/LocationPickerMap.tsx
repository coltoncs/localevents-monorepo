import type { SearchBoxRetrieveResponse } from "@mapbox/search-js-core";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

import {
	createGeoJSONCircle,
	DARK_STYLE,
	DEFAULT_MAP_CENTER,
	getCircleColors,
	getMarkerColor,
	getResolvedTheme,
	LIGHT_STYLE,
} from "#/lib/mapUtils";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

export interface PoiSelection {
	lat: number;
	lng: number;
	name?: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	phone?: string;
	website?: string;
}

interface LocationPickerMapProps {
	lat: number;
	lng: number;
	onCoordinateChange: (lat: number, lng: number) => void;
	onPoiSelect?: (poi: PoiSelection) => void;
	radiusMiles?: number;
	className?: string;
	interactive?: boolean;
}

// `@mapbox/search-js-react` transitively imports `@mapbox/search-js-web`, which
// registers a custom element at module load and touches `document`. That blows
// up under Cloudflare Workers SSR, so load it lazily on the client only.
// biome-ignore lint/suspicious/noExplicitAny: third-party JSX type friction
type SearchBoxComp = React.ComponentType<any>;

export function LocationPickerMap({
	lat,
	lng,
	onCoordinateChange,
	onPoiSelect,
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
	const onPoiSelectRef = useRef(onPoiSelect);
	onPoiSelectRef.current = onPoiSelect;
	const hasCoords = lat !== 0 || lng !== 0;
	const viewCenter = hasCoords ? { lat, lng } : DEFAULT_MAP_CENTER;
	const proximityRef = useRef(viewCenter);
	proximityRef.current = viewCenter;
	const [SearchBoxComponent, setSearchBoxComponent] =
		useState<SearchBoxComp | null>(null);

	useEffect(() => {
		if (!interactive) return;
		let cancelled = false;
		import("@mapbox/search-js-react").then((mod) => {
			if (!cancelled)
				setSearchBoxComponent(() => mod.SearchBox as SearchBoxComp);
		});
		return () => {
			cancelled = true;
		};
	}, [interactive]);

	// Initialize map — intentionally empty deps to run once on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: map init runs once
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;

		themeRef.current = getResolvedTheme();
		const theme = themeRef.current;

		const map = new mapboxgl.Map({
			container: containerRef.current,
			style: theme === "dark" ? DARK_STYLE : LIGHT_STYLE,
			center: [viewCenter.lng, viewCenter.lat],
			zoom: 12,
		});
		mapRef.current = map;

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
		}

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
		if (
			Math.abs(currentPos.lat - lat) < 0.0001 &&
			Math.abs(currentPos.lng - lng) < 0.0001
		)
			return;

		marker.setLngLat([lng, lat]);
		map.flyTo({ center: [lng, lat], duration: 500 });

		if (radiusMiles) {
			updateRadiusData(map, lng, lat, radiusMiles);
		}
	}, [lat, lng, radiusMiles]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const observer = new MutationObserver(() => {
			const newTheme = getResolvedTheme();
			if (newTheme !== themeRef.current) {
				themeRef.current = newTheme;
				map.setStyle(newTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);

				map.once("style.load", () => {
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

	function handleRetrieve(res: SearchBoxRetrieveResponse) {
		const feature = res?.features?.[0];
		if (!feature) return;
		const [featLng, featLat] = feature.geometry.coordinates;
		const props = feature.properties;
		const ctx = props.context ?? {};
		const metadata = (props.metadata ?? {}) as Record<string, unknown>;

		const poi: PoiSelection = {
			lat: featLat,
			lng: featLng,
			name: props.feature_type === "poi" ? props.name : undefined,
			address: props.address || undefined,
			city: ctx.place?.name,
			state: ctx.region?.region_code,
			zip: ctx.postcode?.name,
			phone: typeof metadata.phone === "string" ? metadata.phone : undefined,
			website:
				typeof metadata.website === "string" ? metadata.website : undefined,
		};

		onPoiSelectRef.current?.(poi);
		onChangeRef.current(featLat, featLng);
	}

	return (
		<div className={`relative overflow-hidden ${className}`}>
			<div ref={containerRef} className="h-full w-full" />
			{interactive && SearchBoxComponent && (
				<div className="absolute left-2 top-2 z-10 w-[calc(100%-5rem)] max-w-sm">
					<SearchBoxComponent
						accessToken={mapboxgl.accessToken}
						placeholder="Search places, addresses, or POIs..."
						options={{
							country: "US",
							types: "poi,address,place,postcode,locality,neighborhood",
							proximity: {
								lng: proximityRef.current.lng,
								lat: proximityRef.current.lat,
							},
						}}
						onRetrieve={handleRetrieve}
					/>
				</div>
			)}
		</div>
	);
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

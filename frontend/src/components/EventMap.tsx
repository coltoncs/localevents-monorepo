import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Event } from "#/lib/types";
import {
  LIGHT_STYLE,
  DARK_STYLE,
  getResolvedTheme,
  getMarkerColor as getMarkerColorUtil,
  getCircleColors as getCircleColorsUtil,
  createGeoJSONCircle,
} from "#/lib/mapUtils";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

interface EventMapProps {
  events: Event[];
  center: { lat: number; lng: number };
  radiusMiles?: number;
  zoom?: number;
  className?: string;
  onMapReady?: (map: mapboxgl.Map) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
}

export function EventMap({
  events,
  center,
  radiusMiles = 25,
  zoom = 11,
  className = "h-[500px] w-full rounded-lg",
  onMapReady,
  onMapClick,
}: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const themeRef = useRef<"light" | "dark">(getResolvedTheme());
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const getMarkerColor = useCallback(getMarkerColorUtil, []);
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

        // Find the first symbol layer to insert radius layers beneath labels/icons
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

  // Initialize map
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

    const observer = new MutationObserver(() => {
      const newTheme = getResolvedTheme();
      if (newTheme !== themeRef.current) {
        themeRef.current = newTheme;
        map.setStyle(newTheme === "dark" ? DARK_STYLE : LIGHT_STYLE);

        // Re-add layers and markers after style change
        map.once("style.load", () => {
          updateRadiusCircle(map, center.lng, center.lat, radiusMiles);
          updateCircleColors(map, newTheme);

          const color = getMarkerColor(newTheme);
          markersRef.current.forEach((m) => {
            const lngLat = m.getLngLat();
            const popup = m.getPopup();
            m.remove();
            const newMarker = new mapboxgl.Marker({ color })
              .setLngLat(lngLat)
              .setPopup(popup)
              .addTo(map);
            markersRef.current[markersRef.current.indexOf(m)] = newMarker;
          });
        });
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Also listen for system theme changes (auto mode)
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
    markersRef.current = [];

    const theme = themeRef.current;
    const color = getMarkerColor(theme);

    events.forEach((event) => {
      const popup = new mapboxgl.Popup({
        offset: 25,
        className: "themed-popup",
      }).setHTML(
        `<div class="map-popup-content">
          <strong>${event.Title}</strong>
          <p>${Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.StartTime))}</p>
          ${event.VenueName ? `<p>${event.VenueName}</p>` : ""}
          <a href="/events/${event.ID}">View Details</a>
        </div>`,
      );

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([event.Longitude, event.Latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);

      const el = marker.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        mapRef.current?.flyTo({
          center: [event.Longitude, event.Latitude],
          zoom: 14,
          duration: 1200,
        });
      });

      markersRef.current.push(marker);
    });

    // Fit map to show all markers + the center point
    if (events.length > 0 && mapRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([center.lng, center.lat]);
      events.forEach((event) =>
        bounds.extend([event.Longitude, event.Latitude]),
      );
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [events, getMarkerColor, center.lat, center.lng]);

  return <div ref={containerRef} className={className} />;
}

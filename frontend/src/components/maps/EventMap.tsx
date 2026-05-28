import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Event } from "#/lib/types";
import {
  STANDARD_STYLE,
  STANDARD_SLOT_MIDDLE,
  getLightPreset,
  getResolvedTheme,
  getMarkerColor as getMarkerColorUtil,
  getCircleColors as getCircleColorsUtil,
  createGeoJSONCircle,
  escapeHtml,
} from "#/lib/mapUtils";
import { STORAGE_KEY, type SavedLocation } from "./LocationSearch";
import { useNavigate } from "@tanstack/react-router";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const RADIUS_SOURCE = "radius-circle";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

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
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const themeRef = useRef<"light" | "dark">(getResolvedTheme());
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const selectedEventIdRef = useRef<string | null | undefined>(selectedEventId);
  selectedEventIdRef.current = selectedEventId;

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
      saveLocation({ name: 'My Location', lat: latitude, lng: longitude });
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

      // Marker color is set via constructor; recreate each to update it.
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

    events.forEach((event) => {
      const popup = new mapboxgl.Popup({
        offset: 25,
        className: "themed-popup",
      }).setHTML(
        `<div class="map-popup-content">
          <strong>${escapeHtml(event.Title)}</strong>
          ${event.ImageUrl ? `<img src="${escapeHtml(event.ImageUrl)}" alt="${escapeHtml(event.Title)}" loading="lazy" decoding="async">` : ""}
          <p>${Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.StartTime))}</p>
          ${event.VenueName ? `<p>${escapeHtml(event.VenueName)}</p>` : ""}
          <a href="/events/${encodeURIComponent(event.ID)}">View Details</a>
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

      markersRef.current.set(event.ID, marker);
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

    // If a selection was active before the rebuild, reopen its popup on the new marker
    const selId = selectedEventIdRef.current;
    if (selId) {
      const m = markersRef.current.get(selId);
      const popup = m?.getPopup();
      if (m && popup && !popup.isOpen()) m.togglePopup();
    }
  }, [events, getMarkerColor, center.lat, center.lng]);

  // Respond to external selection: close any open popup and open the matching marker's popup
  useEffect(() => {
    markersRef.current.forEach((m) => {
      const popup = m.getPopup();
      if (popup?.isOpen()) popup.remove();
    });

    if (!selectedEventId) return;
    const marker = markersRef.current.get(selectedEventId);
    const popup = marker?.getPopup();
    if (marker && popup && !popup.isOpen()) marker.togglePopup();
  }, [selectedEventId]);

  return <div ref={containerRef} className={className} />;
}

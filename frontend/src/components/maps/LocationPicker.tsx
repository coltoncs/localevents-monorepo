import { useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface GeocodingFeature {
	place_name: string;
	center: [number, number];
}

export interface LocationValue {
	lat: number;
	lng: number;
	name: string;
}

interface LocationPickerProps {
	value: LocationValue | null;
	onChange: (value: LocationValue) => void;
	label?: string;
	initialLat?: number | null;
	initialLng?: number | null;
}

export function LocationPicker({
	value,
	onChange,
	label = "Default Location",
	initialLat,
	initialLng,
}: LocationPickerProps) {
	const [addressQuery, setAddressQuery] = useState("");
	const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const seededRef = useRef(false);

	useEffect(() => {
		if (seededRef.current) return;
		if (initialLat == null || initialLng == null) return;
		seededRef.current = true;

		onChange({ name: "", lat: initialLat, lng: initialLng });

		fetch(
			`https://api.mapbox.com/geocoding/v5/mapbox.places/${initialLng},${initialLat}.json?access_token=${MAPBOX_TOKEN}&limit=1`,
		)
			.then((r) => r.json())
			.then((data) => {
				if (data.features?.length > 0) {
					onChange({
						name: data.features[0].place_name,
						lat: initialLat,
						lng: initialLng,
					});
				}
			})
			.catch(() => {});
	}, [initialLat, initialLng, onChange]);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	function handleAddressChange(next: string) {
		setAddressQuery(next);
		setOpen(true);

		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (next.trim().length < 3) {
			setSuggestions([]);
			return;
		}

		debounceRef.current = setTimeout(() => {
			fetch(
				`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(next)}.json?access_token=${MAPBOX_TOKEN}&types=address,place,locality,neighborhood,postcode&limit=5&country=us`,
			)
				.then((r) => r.json())
				.then((data) => setSuggestions(data.features ?? []))
				.catch(() => setSuggestions([]));
		}, 300);
	}

	function handleSelect(feature: GeocodingFeature) {
		const [lng, lat] = feature.center;
		onChange({ name: feature.place_name, lat, lng });
		setAddressQuery("");
		setSuggestions([]);
		setOpen(false);
	}

	return (
		<div>
			<label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
				{label}
			</label>
			<div ref={wrapperRef} className="relative mt-1">
				<input
					type="text"
					value={addressQuery}
					onChange={(e) => handleAddressChange(e.target.value)}
					onFocus={() => addressQuery.trim().length >= 3 && setOpen(true)}
					placeholder={value?.name || "Enter an address or city..."}
					className="block w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)] focus:outline-none"
				/>
				{open && suggestions.length > 0 && (
					<ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--surface-strong)] py-1 shadow-lg">
						{suggestions.map((feature) => (
							<li key={feature.place_name}>
								<button
									type="button"
									onClick={() => handleSelect(feature)}
									className="w-full px-3 py-2 text-left text-sm text-[var(--sea-ink-soft)] hover:bg-[rgba(79,184,178,0.08)] hover:text-[var(--lagoon-deep)]"
								>
									{feature.place_name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
			{value?.name && (
				<p className="mt-1.5 text-sm text-[var(--sea-ink-soft)]">
					{value.name}
				</p>
			)}
		</div>
	);
}

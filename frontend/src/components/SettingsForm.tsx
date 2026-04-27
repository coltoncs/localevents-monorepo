import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	LocationPicker,
	type LocationValue,
} from "#/components/LocationPicker";
import { useUpdateSettings, useUser } from "#/lib/hooks/useUser";

export function SettingsForm() {
	const { data: user } = useUser();
	const updateSettings = useUpdateSettings();

	const [selectedLocation, setSelectedLocation] =
		useState<LocationValue | null>(null);

	const form = useForm({
		defaultValues: {
			default_radius_miles: user?.DefaultRadiusMiles ?? 10,
		},
		onSubmit: async ({ value }) => {
			await updateSettings.mutateAsync({
				default_latitude: selectedLocation?.lat || undefined,
				default_longitude: selectedLocation?.lng || undefined,
				default_radius_miles: Number(value.default_radius_miles) || undefined,
			});
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<LocationPicker
				value={selectedLocation}
				onChange={setSelectedLocation}
				initialLat={user?.DefaultLatitude}
				initialLng={user?.DefaultLongitude}
			/>

			<form.Field name="default_radius_miles">
				{(field) => (
					<div>
						<label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
							Default Search Radius (miles)
						</label>
						<select
							value={field.state.value}
							onChange={(e) => field.handleChange(Number(e.target.value))}
							className="mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]"
						>
							{[5, 10, 25, 50, 100].map((r) => (
								<option key={r} value={r}>
									{r} miles
								</option>
							))}
						</select>
					</div>
				)}
			</form.Field>

			{updateSettings.isSuccess && (
				<p className="text-sm text-green-600">Settings saved.</p>
			)}
			{updateSettings.isError && (
				<p className="text-sm text-red-600">Failed to save settings.</p>
			)}

			<button
				type="submit"
				disabled={updateSettings.isPending}
				className="rounded-md bg-[var(--lagoon-deep)] px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--lagoon)] disabled:opacity-50"
			>
				{updateSettings.isPending ? "Saving..." : "Save Settings"}
			</button>
		</form>
	);
}

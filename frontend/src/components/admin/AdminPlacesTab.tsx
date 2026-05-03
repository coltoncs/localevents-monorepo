import { AdminSuggestionsTab } from "#/components/admin/AdminSuggestionsTab";
import { PlaceManager } from "#/components/places/PlaceManager";

export function AdminPlacesTab() {
	return (
		<div className="space-y-8">
			<PlaceManager />

			<div>
				<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
					Pending Place Suggestions
				</h2>
				<AdminSuggestionsTab targetType="place" />
			</div>
		</div>
	);
}

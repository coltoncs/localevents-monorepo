import { AdminSuggestionsTab } from "#/components/admin/AdminSuggestionsTab";
import { FoodManager } from "#/components/FoodManager";

export function AdminFoodsTab() {
	return (
		<div className="space-y-8">
			<FoodManager />

			<div>
				<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
					Pending Restaurant Suggestions
				</h2>
				<AdminSuggestionsTab targetType="food" />
			</div>
		</div>
	);
}

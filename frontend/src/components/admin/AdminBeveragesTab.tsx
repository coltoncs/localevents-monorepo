import { AdminSuggestionsTab } from "#/components/admin/AdminSuggestionsTab";
import { BeverageManager } from "#/components/BeverageManager";

export function AdminBeveragesTab() {
	return (
		<div className="space-y-8">
			<BeverageManager />

			<div>
				<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
					Pending Bar & Brewery Suggestions
				</h2>
				<AdminSuggestionsTab targetType="beverage" />
			</div>
		</div>
	);
}

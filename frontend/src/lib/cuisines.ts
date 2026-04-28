import type { Cuisine } from "#/lib/types";

export function formatCuisineLabel(cuisine: string): string {
	return cuisine
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

export const CUISINES: { value: Cuisine; label: string }[] = [
	{ value: "american", label: "American" },
	{ value: "italian", label: "Italian" },
	{ value: "mexican", label: "Mexican" },
	{ value: "chinese", label: "Chinese" },
	{ value: "japanese", label: "Japanese" },
	{ value: "korean", label: "Korean" },
	{ value: "thai", label: "Thai" },
	{ value: "vietnamese", label: "Vietnamese" },
	{ value: "indian", label: "Indian" },
	{ value: "mediterranean", label: "Mediterranean" },
	{ value: "middle_eastern", label: "Middle Eastern" },
	{ value: "french", label: "French" },
	{ value: "bbq", label: "BBQ" },
	{ value: "pizza", label: "Pizza" },
	{ value: "seafood", label: "Seafood" },
	{ value: "vegan", label: "Vegan" },
	{ value: "cafe", label: "Cafe" },
	{ value: "bakery", label: "Bakery" },
	{ value: "dessert", label: "Dessert" },
];

const KNOWN: Set<string> = new Set(CUISINES.map((c) => c.value));

export function isCuisine(v: unknown): v is Cuisine {
	return typeof v === "string" && v.length > 0 && v.length <= 50;
}

export function isKnownCuisine(v: string): boolean {
	return KNOWN.has(v);
}

export function mergeCuisines(
	extras: Iterable<string>,
): { value: Cuisine; label: string }[] {
	const seen = new Set<string>(KNOWN);
	const out = [...CUISINES];
	for (const c of extras) {
		if (!c || seen.has(c)) continue;
		seen.add(c);
		out.push({ value: c, label: formatCuisineLabel(c) });
	}
	return out;
}

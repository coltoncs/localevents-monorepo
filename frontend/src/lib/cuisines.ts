import type { Cuisine } from "#/lib/types";

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
	{ value: "other", label: "Other" },
];

const VALID: Set<string> = new Set(CUISINES.map((c) => c.value));

export function isCuisine(v: unknown): v is Cuisine {
	return typeof v === "string" && VALID.has(v);
}

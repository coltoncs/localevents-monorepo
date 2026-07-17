// City landing pages powering geo-scoped ad destinations (e.g. /events/in/raleigh).
// Each entry pins a location + radius so paid/organic visitors land directly on a
// relevant, keyword-matching page instead of the generic homepage.

export interface LandingCity {
	slug: string;
	name: string;
	region: string; // state abbreviation, e.g. "NC"
	lat: number;
	lng: number;
	radius: number; // miles
	blurb: string;
}

export const LANDING_CITIES: Record<string, LandingCity> = {
	raleigh: {
		slug: "raleigh",
		name: "Raleigh",
		region: "NC",
		lat: 35.7796,
		lng: -78.6382,
		radius: 20,
		blurb:
			"Concerts, festivals, food & drink, and things to do around Raleigh — updated as new events are added.",
	},
	durham: {
		slug: "durham",
		name: "Durham",
		region: "NC",
		lat: 35.994,
		lng: -78.8986,
		radius: 20,
		blurb:
			"Live music, festivals, and things to do around Durham and the Bull City — updated as new events are added.",
	},
	cary: {
		slug: "cary",
		name: "Cary",
		region: "NC",
		lat: 35.7915,
		lng: -78.7811,
		radius: 15,
		blurb:
			"Events, concerts, and things to do around Cary and western Wake County — updated as new events are added.",
	},
	"chapel-hill": {
		slug: "chapel-hill",
		name: "Chapel Hill",
		region: "NC",
		lat: 35.9132,
		lng: -79.0558,
		radius: 15,
		blurb:
			"Shows, festivals, and things to do around Chapel Hill and Carrboro — updated as new events are added.",
	},
	richmond: {
		slug: "richmond",
		name: "Richmond",
		region: "VA",
		lat: 37.5407,
		lng: -77.436,
		radius: 20,
		blurb:
			"Concerts, festivals, and things to do around Richmond — updated as new events are added.",
	},
};

export function getLandingCity(slug?: string): LandingCity | undefined {
	if (!slug) return undefined;
	return LANDING_CITIES[slug.toLowerCase()];
}

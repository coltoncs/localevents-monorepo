package scraper

import "strings"

// CanonicalGenres is the set of music genres we tag events with. Sources use a
// wide variety of names for the same genre, so NormalizeGenres folds raw values
// into this list. Kept intentionally broad — these are the buckets a user is
// likely to ask for ("find me jazz / metal / hip-hop shows").
var CanonicalGenres = []string{
	"Rock",
	"Pop",
	"Hip-Hop",
	"R&B",
	"Country",
	"Jazz",
	"Blues",
	"Classical",
	"Folk",
	"Metal",
	"Punk",
	"Electronic",
	"Latin",
	"Reggae",
	"Indie",
	"Alternative",
	"Soul",
	"Funk",
	"Gospel",
	"World",
}

// genreAliases maps lowercased raw genre/sub-genre strings (as they appear in
// Ticketmaster classifications and SeatGeek performer genres) to a canonical
// genre. Anything not found here but recognized as a canonical genre is kept
// as-is; truly unknown values are dropped so the tag set stays meaningful.
var genreAliases = map[string]string{
	"hip-hop/rap":           "Hip-Hop",
	"hip hop":               "Hip-Hop",
	"hip-hop":               "Hip-Hop",
	"hiphop":                "Hip-Hop",
	"rap":                   "Hip-Hop",
	"trap":                  "Hip-Hop",
	"r&b":                   "R&B",
	"rnb":                   "R&B",
	"r&b/soul":              "R&B",
	"rhythm and blues":      "R&B",
	"rhythm & blues":        "R&B",
	"soul":                  "Soul",
	"neo-soul":              "Soul",
	"funk":                  "Funk",
	"electronic/dance":      "Electronic",
	"dance/electronic":      "Electronic",
	"dance/electronica":     "Electronic",
	"electronica":           "Electronic",
	"electronic":            "Electronic",
	"edm":                   "Electronic",
	"house":                 "Electronic",
	"techno":                "Electronic",
	"dubstep":               "Electronic",
	"dance":                 "Electronic",
	"rock":                  "Rock",
	"classic rock":          "Rock",
	"hard rock":             "Rock",
	"pop rock":              "Rock",
	"pop":                   "Pop",
	"dance pop":             "Pop",
	"synth pop":             "Pop",
	"k-pop":                 "Pop",
	"country":               "Country",
	"americana":             "Country",
	"bluegrass":             "Folk",
	"folk":                  "Folk",
	"singer-songwriter":     "Folk",
	"jazz":                  "Jazz",
	"smooth jazz":           "Jazz",
	"blues":                 "Blues",
	"classical":             "Classical",
	"orchestral":            "Classical",
	"opera":                 "Classical",
	"metal":                 "Metal",
	"heavy metal":           "Metal",
	"metalcore":             "Metal",
	"hardcore":              "Punk",
	"punk":                  "Punk",
	"pop punk":              "Punk",
	"latin":                 "Latin",
	"reggaeton":             "Latin",
	"regional mexican":      "Latin",
	"salsa":                 "Latin",
	"reggae":                "Reggae",
	"ska":                   "Reggae",
	"dancehall":             "Reggae",
	"indie":                 "Indie",
	"indie rock":            "Indie",
	"indie pop":             "Indie",
	"alternative":           "Alternative",
	"alternative rock":      "Alternative",
	"alt":                   "Alternative",
	"gospel":                "Gospel",
	"religious":             "Gospel",
	"christian":             "Gospel",
	"world":                 "World",
	"world music":           "World",
	"afrobeat":              "World",
	"afrobeats":             "World",
}

// NormalizeGenres folds a list of raw source genre/sub-genre strings into a
// deduplicated set of canonical genres. Unrecognized values are dropped.
// "Other", "Undefined", and empty strings are ignored. Caps at 4 genres.
func NormalizeGenres(raw []string) []string {
	seen := make(map[string]bool)
	var result []string

	canonicalSet := make(map[string]string, len(CanonicalGenres))
	for _, g := range CanonicalGenres {
		canonicalSet[strings.ToLower(g)] = g
	}

	for _, r := range raw {
		key := strings.ToLower(strings.TrimSpace(r))
		if key == "" || key == "other" || key == "undefined" {
			continue
		}

		var canon string
		if mapped, ok := genreAliases[key]; ok {
			canon = mapped
		} else if c, ok := canonicalSet[key]; ok {
			canon = c
		} else {
			continue
		}

		if !seen[canon] && len(result) < 4 {
			seen[canon] = true
			result = append(result, canon)
		}
	}

	return result
}

package scraper

import "strings"

// CanonicalGenres is the set of music genres surfaced in the Music/Concerts
// section's genre filter. Mirrors MUSIC_GENRES on the frontend. Events should
// only be tagged with values from this list.
var CanonicalGenres = []string{
	"Rock",
	"Pop",
	"Hip-Hop/Rap",
	"R&B/Soul",
	"Country",
	"Folk/Americana",
	"Jazz",
	"Blues",
	"Electronic/EDM",
	"Classical",
	"Metal",
	"Punk",
	"Reggae",
	"Latin",
	"World",
	"Indie",
	"Other",
}

// genreKeywordRules maps canonical genres to substrings matched (case
// insensitively) against source-provided genre/subgenre strings. Order
// matters: earlier, more specific rules win so e.g. "Hip-Hop/Rap" is matched
// before a bare "pop" elsewhere. Each raw genre string resolves to at most one
// canonical genre (the first rule it matches).
var genreKeywordRules = []struct {
	genre    string
	keywords []string
}{
	{"Hip-Hop/Rap", []string{"hip-hop", "hip hop", "rap", "trap"}},
	{"R&B/Soul", []string{"r&b", "rnb", "soul", "funk", "motown"}},
	{"Electronic/EDM", []string{"electronic", "edm", "dance", "house", "techno", "dubstep", "dj", "trance"}},
	{"Folk/Americana", []string{"folk", "americana", "bluegrass", "singer & songwriter", "singer-songwriter"}},
	{"Country", []string{"country", "western"}},
	{"Metal", []string{"metal"}},
	{"Punk", []string{"punk", "hardcore", "emo"}},
	{"Jazz", []string{"jazz", "swing", "big band"}},
	{"Blues", []string{"blues"}},
	{"Reggae", []string{"reggae", "ska", "dancehall", "dub"}},
	{"Latin", []string{"latin", "salsa", "reggaeton", "merengue", "bachata", "cumbia", "tejano", "mariachi"}},
	{"Classical", []string{"classical", "orchestra", "symphony", "opera", "chamber", "baroque"}},
	{"World", []string{"world", "afrobeat", "celtic", "flamenco", "k-pop", "j-pop"}},
	{"Indie", []string{"indie", "alternative", "alt-rock", "shoegaze"}},
	{"Rock", []string{"rock", "grunge", "psychedelic"}},
	{"Pop", []string{"pop", "top 40", "adult contemporary"}},
}

// NormalizeGenres maps raw source genre/subgenre strings to a deduplicated set
// of 1–3 canonical genres. Strings that match no rule are dropped; if at least
// one raw string was supplied but none matched, it returns {"Other"} so the
// event still shows under the genre filter's "Other" bucket.
func NormalizeGenres(raw []string) []string {
	seen := make(map[string]bool)
	var result []string

	for _, src := range raw {
		key := strings.ToLower(strings.TrimSpace(src))
		if key == "" || key == "undefined" || key == "other" {
			continue
		}
		for _, rule := range genreKeywordRules {
			matched := false
			for _, kw := range rule.keywords {
				if strings.Contains(key, kw) {
					matched = true
					break
				}
			}
			if matched && !seen[rule.genre] {
				seen[rule.genre] = true
				result = append(result, rule.genre)
				break
			}
			if matched {
				break
			}
		}
		if len(result) >= 3 {
			return result
		}
	}

	if len(result) == 0 {
		for _, src := range raw {
			if strings.TrimSpace(src) != "" {
				return []string{"Other"}
			}
		}
	}

	return result
}

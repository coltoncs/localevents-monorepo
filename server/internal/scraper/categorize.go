package scraper

import "strings"

// canonicalCategories is the set of frontend categories. Events should only
// be tagged with values from this list.
var canonicalCategories = []string{
	"Music",
	"Sports",
	"Arts",
	"Kids",
	"Food & Drink",
	"Tech",
	"Entertainment",
	"Community",
	"Outdoors",
	"Nightlife",
}

// sourceMapping maps known source-provided category strings (lowercased) to
// one or more canonical categories. Covers Ticketmaster segments, SeatGeek
// types, and Visit Raleigh/Richmond category names.
var sourceMapping = map[string][]string{
	// Ticketmaster segments
	"music":           {"Music"},
	"sports":          {"Sports"},
	"arts & theatre":  {"Arts", "Entertainment"},
	"film":            {"Entertainment"},
	"family":          {"Kids"},
	"miscellaneous":   {},
	"undefined":       {},

	// SeatGeek types
	"concert":                      {"Music"},
	"concerts":                     {"Music"},
	"music_festival":               {"Music", "Community"},
	"theater":                      {"Arts", "Entertainment"},
	"theatre":                      {"Arts", "Entertainment"},
	"comedy":                       {"Entertainment", "Nightlife"},
	"dance_performance_tour":       {"Arts"},
	"classical":                    {"Music", "Arts"},
	"classical_orchestral_instrumental": {"Music", "Arts"},
	"broadway_tickets_national":    {"Arts", "Entertainment"},
	"minor_league_baseball":        {"Sports"},
	"minor_league_hockey":          {"Sports"},
	"nba":                          {"Sports"},
	"nfl":                          {"Sports"},
	"nhl":                          {"Sports"},
	"mlb":                          {"Sports"},
	"mls":                          {"Sports"},
	"ncaa_football":                {"Sports"},
	"ncaa_basketball":              {"Sports"},
	"ncaa_baseball":                {"Sports"},
	"ncaa_hockey":                  {"Sports"},
	"ncaa_womens_basketball":       {"Sports"},
	"soccer":                       {"Sports"},
	"wrestling":                    {"Sports", "Entertainment"},
	"fighting":                     {"Sports"},
	"golf":                         {"Sports", "Outdoors"},
	"tennis":                       {"Sports"},
	"horse_racing":                 {"Sports"},
	"auto_racing":                  {"Sports"},
	"rodeo":                        {"Sports", "Entertainment"},
	"literary":                     {"Arts", "Community"},
	"cirque_du_soleil":             {"Entertainment"},
	"circus":                       {"Entertainment", "Kids"},
	"magic_and_illusion":           {"Entertainment"},
	"animal_attraction":            {"Kids", "Outdoors"},

	// Visit Raleigh / Visit Richmond category names
	"live music":              {"Music"},
	"performing arts":         {"Arts"},
	"visual arts":             {"Arts"},
	"galleries":               {"Arts"},
	"museums":                 {"Arts"},
	"exhibits":                {"Arts"},
	"festivals":               {"Community"},
	"festivals & fairs":       {"Community"},
	"fairs":                   {"Community"},
	"holiday":                 {"Community"},
	"holiday events":          {"Community"},
	"family-friendly":         {"Kids"},
	"family friendly":         {"Kids"},
	"kids":                    {"Kids"},
	"children":                {"Kids"},
	"food & wine":             {"Food & Drink"},
	"food & drink":            {"Food & Drink"},
	"food":                    {"Food & Drink"},
	"wine":                    {"Food & Drink"},
	"beer":                    {"Food & Drink"},
	"culinary":                {"Food & Drink"},
	"outdoor activities":      {"Outdoors"},
	"outdoors":                {"Outdoors"},
	"outdoor recreation":      {"Outdoors"},
	"nature":                  {"Outdoors"},
	"nightlife":               {"Nightlife"},
	"nightlife & bars":        {"Nightlife"},
	"bars & clubs":            {"Nightlife"},
	"comedy shows":            {"Entertainment", "Nightlife"},
	"theater & shows":         {"Arts", "Entertainment"},
	"sport":                   {"Sports"},
	"sporting events":         {"Sports"},
	"races":                   {"Sports", "Outdoors"},
	"charity & causes":        {"Community"},
	"community":               {"Community"},
	"markets":                 {"Community", "Food & Drink"},
	"farmers market":          {"Community", "Food & Drink"},
	"tech":                    {"Tech"},
	"technology":              {"Tech"},
	"movies":                  {"Entertainment"},
	"cinema":                  {"Entertainment"},
	"education":               {"Community"},
	"wellness":                {"Community"},
	"health & wellness":       {"Community"},
	"fitness":                 {"Outdoors"},
	"tours":                   {"Community"},
	"historical":              {"Arts", "Community"},
	"history":                 {"Arts", "Community"},
}

// keywordRules maps canonical categories to keyword patterns matched against
// the lowercased event title and description. Order matters — earlier keywords
// are more specific to avoid false positives.
var keywordRules = []struct {
	category string
	keywords []string
}{
	{"Music", []string{
		"concert", "live music", "band", "symphony", "orchestra",
		"jazz", "blues", "hip hop", "rapper", "singer", "songwriter",
		"choir", "acoustic", "album", "tour",
	}},
	{"Sports", []string{
		"game", "match", "tournament", "championship", "playoff",
		"race", "marathon", "5k", "10k", "half marathon",
		"hockey", "basketball", "baseball", "football", "soccer",
		"lacrosse", "tennis", "golf", "wrestling", "boxing",
		"hurricanes", "wolfpack", "nc state", "duke", "unc",
		"blue devils", "tar heels", "demon deacons",
	}},
	{"Arts", []string{
		"exhibit", "exhibition", "gallery", "museum", "theater", "theatre",
		"ballet", "opera", "symphony", "dance performance", "art show",
		"sculpture", "painting", "pottery", "mural",
	}},
	{"Kids", []string{
		"kids", "children", "family-friendly", "family friendly",
		"youth", "toddler", "storytime", "story time", "puppet",
		"ages 3", "ages 4", "ages 5", "all ages",
	}},
	{"Food & Drink", []string{
		"food truck", "wine tasting", "beer festival", "brewery",
		"brunch", "dinner", "tasting", "chef", "culinary",
		"cocktail", "distillery", "food festival",
		"farmers market", "bake", "cook-off", "cookoff",
	}},
	{"Tech", []string{
		"hackathon", "coding", "startup", "developer", "software",
		"tech talk", "ai ", "machine learning", "data science",
		"cyber", "robotics", "innovation",
	}},
	{"Entertainment", []string{
		"comedy", "stand-up", "standup", "comedian", "improv",
		"magic", "circus", "carnival", "movie", "film screening",
		"trivia", "karaoke", "drag show", "burlesque",
	}},
	{"Community", []string{
		"meetup", "meet-up", "volunteer", "fundraiser", "charity",
		"market", "fair", "parade", "cleanup", "workshop",
		"networking", "open house", "town hall", "block party",
	}},
	{"Outdoors", []string{
		"hike", "hiking", "kayak", "canoe", "outdoor", "nature walk",
		"garden", "botanical", "trail", "camping", "fishing",
		"bird watching", "birding", "paddle", "bike ride",
	}},
	{"Nightlife", []string{
		"dj ", "dj set", "club night", "bar crawl", "happy hour",
		"drag", "dance party", "late night", "after dark",
		"rooftop party", "ladies night", "open mic",
	}},
}

// Categorize maps source-provided categories and event content to 1–3
// canonical frontend categories. It first tries direct mapping of existing
// source categories, then falls back to keyword matching on title and
// description.
func Categorize(e *RawEvent) []string {
	seen := make(map[string]bool)
	var result []string

	add := func(cats []string) {
		for _, c := range cats {
			if !seen[c] && len(result) < 3 {
				seen[c] = true
				result = append(result, c)
			}
		}
	}

	// Phase 1: map source-provided categories.
	for _, src := range e.Categories {
		key := strings.ToLower(strings.TrimSpace(src))
		if mapped, ok := sourceMapping[key]; ok {
			add(mapped)
		}
	}

	if len(result) >= 3 {
		return result
	}

	// Phase 2: keyword matching on title + description.
	text := strings.ToLower(e.Title + " " + e.Description)

	for _, rule := range keywordRules {
		if seen[rule.category] {
			continue
		}
		for _, kw := range rule.keywords {
			if strings.Contains(text, kw) {
				add([]string{rule.category})
				break
			}
		}
		if len(result) >= 3 {
			return result
		}
	}

	// Phase 3: if still nothing, check if any source category is already
	// a canonical category (case-insensitive exact match).
	if len(result) == 0 {
		for _, src := range e.Categories {
			trimmed := strings.TrimSpace(src)
			for _, canon := range canonicalCategories {
				if strings.EqualFold(trimmed, canon) {
					add([]string{canon})
					break
				}
			}
		}
	}

	return result
}

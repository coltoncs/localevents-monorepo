package scraper

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

var (
	// admissionAmountRe matches a dollar amount: $15, $10.75, $1,000, $31.99.
	admissionAmountRe = regexp.MustCompile(`\$\s*(\d[\d,]*(?:\.\d{1,2})?)`)
	// admissionOpenEndedRe matches an open-ended floor like "$30+" — a plus
	// sign immediately following the amount (no space, so "$75 +tax" is excluded).
	admissionOpenEndedRe = regexp.MustCompile(`\$\s*\d[\d,]*(?:\.\d{1,2})?\+`)
)

// parseAdmission interprets a free-text admission/price string from the
// Simpleview "visit" event APIs into price bounds and an explicit free flag.
//
// Examples:
//
//	""                                   -> nil, nil, false  (unknown — NOT free)
//	"Free" / "Free!" / "Free; please RSVP" -> nil, nil, true
//	"$15"                                -> 15, 15, false
//	"$30+"                               -> 30, nil, false   (floor, no ceiling)
//	"$85 - $185"                         -> 85, 185, false
//	"Resident $20, non resident $25"     -> 20, 25, false
//	"Free for members, $10 otherwise"    -> 10, 10, false   (a paid tier exists)
//	"Donations accepted" / "Varies"      -> nil, nil, false  (unknown — NOT free)
//
// The guiding rule: an event is only free when the text says so AND lists no
// price. Absence of any price text means the price is unknown, not free.
func parseAdmission(s string) (priceMin, priceMax *float64, isFree bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil, false
	}

	amounts := extractDollarAmounts(s)

	if len(amounts) == 0 {
		// No prices listed. Only call it free when the text says so.
		if strings.Contains(strings.ToLower(s), "free") {
			return nil, nil, true
		}
		return nil, nil, false
	}

	lo, hi := amounts[0], amounts[0]
	for _, v := range amounts[1:] {
		if v < lo {
			lo = v
		}
		if v > hi {
			hi = v
		}
	}

	// "$0" / "$0.00" with no higher tier means free admission.
	if hi == 0 {
		return nil, nil, true
	}

	switch {
	case len(amounts) == 1 && admissionOpenEndedRe.MatchString(s):
		// "$30+" — a floor with no ceiling.
		return &lo, nil, false
	case lo == hi:
		return &lo, &lo, false
	default:
		return &lo, &hi, false
	}
}

// extractDollarAmounts returns every dollar amount mentioned in s, in order.
func extractDollarAmounts(s string) []float64 {
	var amounts []float64
	for _, m := range admissionAmountRe.FindAllStringSubmatch(s, -1) {
		if v, ok := parsePriceString(m[1]); ok {
			amounts = append(amounts, v)
		}
	}
	return amounts
}

// parsePriceString parses a numeric price token (commas allowed, optional
// leading "$"), returning false if it isn't a valid number.
func parsePriceString(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "$")
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// ddOffer mirrors the price-bearing fields of a schema.org Offer. JSON-LD
// encodes these numbers inconsistently (bare numbers or quoted strings), so
// each is captured raw and parsed flexibly.
type ddOffer struct {
	Price     json.RawMessage `json:"price"`
	LowPrice  json.RawMessage `json:"lowPrice"`
	HighPrice json.RawMessage `json:"highPrice"`
}

// parseOffers interprets a schema.org Event "offers" value (a single Offer or
// an array of Offers) into price bounds and an explicit free flag. An offer
// with no parseable price yields unknown (nil, nil, false) — a missing price
// does not imply free. An explicit price of 0 is treated as free.
func parseOffers(raw json.RawMessage) (priceMin, priceMax *float64, isFree bool) {
	if len(raw) == 0 {
		return nil, nil, false
	}

	var offers []ddOffer
	if err := json.Unmarshal(raw, &offers); err != nil {
		var single ddOffer
		if err := json.Unmarshal(raw, &single); err != nil {
			return nil, nil, false
		}
		offers = []ddOffer{single}
	}

	var amounts []float64
	for _, o := range offers {
		for _, f := range []json.RawMessage{o.Price, o.LowPrice, o.HighPrice} {
			if v, ok := flexFloat(f); ok {
				amounts = append(amounts, v)
			}
		}
	}
	if len(amounts) == 0 {
		return nil, nil, false
	}

	lo, hi := amounts[0], amounts[0]
	for _, v := range amounts[1:] {
		if v < lo {
			lo = v
		}
		if v > hi {
			hi = v
		}
	}
	if hi == 0 {
		return nil, nil, true
	}
	if lo == hi {
		return &lo, &lo, false
	}
	return &lo, &hi, false
}

// flexFloat parses a JSON value that may be a bare number or a quoted string
// (e.g. 25, "25", "25.00", "$25").
func flexFloat(raw json.RawMessage) (float64, bool) {
	if len(raw) == 0 {
		return 0, false
	}
	// Try as a bare number first.
	var n float64
	if err := json.Unmarshal(raw, &n); err == nil {
		return n, true
	}
	// Fall back to a quoted string.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return parsePriceString(s)
	}
	return 0, false
}

package scraper

import (
	"encoding/json"
	"strconv"
	"testing"
)

func f64(v float64) *float64 { return &v }

func eqPtr(a, b *float64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func TestParseAdmission(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		wantMin *float64
		wantMax *float64
		free    bool
	}{
		// Absence / non-committal text must NOT be treated as free.
		{"empty", "", nil, nil, false},
		{"whitespace", "   ", nil, nil, false},
		{"varies", "Varies", nil, nil, false},
		{"donations", "Donations accepted", nil, nil, false},
		{"see website", "See website for details", nil, nil, false},

		// Explicit free (real samples from Visit Raleigh / Chapel Hill).
		{"free", "Free", nil, nil, true},
		{"free bang", "Free!", nil, nil, true},
		{"free rsvp", "Free; please RSVP", nil, nil, true},
		{"free register", "Free, please register. Ages 55+", nil, nil, true},
		{"zero dollars", "$0", nil, nil, true},
		{"zero dollars decimal", "$0.00", nil, nil, true},

		// Single price.
		{"single", "$15", f64(15), f64(15), false},
		{"single decimal", "$10.75", f64(10.75), f64(10.75), false},
		{"with tax suffix", "$75 +tax", f64(75), f64(75), false},

		// Open-ended floor.
		{"open ended", "$30+", f64(30), nil, false},
		{"open ended big", "$72+", f64(72), nil, false},

		// Ranges and multi-amount strings.
		{"range", "$85 - $185", f64(85), f64(185), false},
		{"range decimals", "$31.99 - $190.99", f64(31.99), f64(190.99), false},
		{"resident/nonresident", "Resident $20, non resident $25, 18+ years of age.", f64(20), f64(25), false},

		// A paid tier wins over the word "free".
		{"free plus paid", "Free for members, $10 for non-members", f64(10), f64(10), false},

		// Thousands separator.
		{"thousands", "$1,000", f64(1000), f64(1000), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotMin, gotMax, gotFree := parseAdmission(tt.in)
			if !eqPtr(gotMin, tt.wantMin) || !eqPtr(gotMax, tt.wantMax) || gotFree != tt.free {
				t.Errorf("parseAdmission(%q) = (%v, %v, %v), want (%v, %v, %v)",
					tt.in, derefStr(gotMin), derefStr(gotMax), gotFree,
					derefStr(tt.wantMin), derefStr(tt.wantMax), tt.free)
			}
		})
	}
}

func TestParseOffers(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		wantMin *float64
		wantMax *float64
		free    bool
	}{
		{"empty", ``, nil, nil, false},
		{"url only", `{"@type":"Offer","priceCurrency":"USD","url":"https://x"}`, nil, nil, false},
		{"single string price", `{"price":"25.00"}`, f64(25), f64(25), false},
		{"single number price", `{"price":25}`, f64(25), f64(25), false},
		{"low/high", `{"lowPrice":"10","highPrice":"40"}`, f64(10), f64(40), false},
		{"zero is free", `{"price":"0"}`, nil, nil, true},
		{"array of offers", `[{"price":"15"},{"price":"45"}]`, f64(15), f64(45), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var raw json.RawMessage
			if tt.in != "" {
				raw = json.RawMessage(tt.in)
			}
			gotMin, gotMax, gotFree := parseOffers(raw)
			if !eqPtr(gotMin, tt.wantMin) || !eqPtr(gotMax, tt.wantMax) || gotFree != tt.free {
				t.Errorf("parseOffers(%q) = (%v, %v, %v), want (%v, %v, %v)",
					tt.in, derefStr(gotMin), derefStr(gotMax), gotFree,
					derefStr(tt.wantMin), derefStr(tt.wantMax), tt.free)
			}
		})
	}
}

func derefStr(p *float64) string {
	if p == nil {
		return "nil"
	}
	return strconv.FormatFloat(*p, 'f', -1, 64)
}

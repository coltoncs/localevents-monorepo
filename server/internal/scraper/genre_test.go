package scraper

import (
	"slices"
	"testing"
)

func TestNormalizeGenres(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{"empty", nil, nil},
		{"ticketmaster hip hop", []string{"Hip-Hop/Rap"}, []string{"Hip-Hop"}},
		{"alias rap", []string{"rap"}, []string{"Hip-Hop"}},
		{"canonical passthrough", []string{"Jazz"}, []string{"Jazz"}},
		{"case insensitive", []string{"ROCK"}, []string{"Rock"}},
		{"dedup genre+subgenre", []string{"Rock", "Classic Rock"}, []string{"Rock"}},
		{"electronic family", []string{"EDM", "House"}, []string{"Electronic"}},
		{"drops noise", []string{"Other", "Undefined", ""}, nil},
		{"drops unknown", []string{"Polka"}, nil},
		{"caps at four", []string{"Rock", "Pop", "Jazz", "Blues", "Folk"}, []string{"Rock", "Pop", "Jazz", "Blues"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeGenres(tt.in)
			if !slices.Equal(got, tt.want) {
				t.Errorf("NormalizeGenres(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

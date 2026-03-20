package handler

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

const siteURL = "https://919events.com"

type SitemapHandler struct {
	queries *store.Queries
}

func NewSitemapHandler(q *store.Queries) *SitemapHandler {
	return &SitemapHandler{queries: q}
}

type sitemapURL struct {
	XMLName    xml.Name `xml:"url"`
	Loc        string   `xml:"loc"`
	LastMod    string   `xml:"lastmod,omitempty"`
	ChangeFreq string   `xml:"changefreq,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL  `xml:"url"`
}

func (h *SitemapHandler) Sitemap(w http.ResponseWriter, r *http.Request) {
	urls := []sitemapURL{
		{Loc: siteURL + "/", ChangeFreq: "weekly"},
		{Loc: siteURL + "/events", ChangeFreq: "daily"},
		{Loc: siteURL + "/about", ChangeFreq: "monthly"},
	}

	events, err := h.queries.ListEventIDsForSitemap(r.Context())
	if err == nil {
		for _, e := range events {
			id := fmt.Sprintf("%x-%x-%x-%x-%x", e.ID.Bytes[0:4], e.ID.Bytes[4:6], e.ID.Bytes[6:8], e.ID.Bytes[8:10], e.ID.Bytes[10:16])
			u := sitemapURL{
				Loc:        siteURL + "/events/" + id,
				ChangeFreq: "daily",
			}
			if e.UpdatedAt.Valid {
				u.LastMod = e.UpdatedAt.Time.Format(time.DateOnly)
			}
			urls = append(urls, u)
		}
	}

	venues, err := h.queries.ListVenueIDsForSitemap(r.Context())
	if err == nil {
		for _, v := range venues {
			id := fmt.Sprintf("%x-%x-%x-%x-%x", v.ID.Bytes[0:4], v.ID.Bytes[4:6], v.ID.Bytes[6:8], v.ID.Bytes[8:10], v.ID.Bytes[10:16])
			u := sitemapURL{
				Loc:        siteURL + "/venues/" + id,
				ChangeFreq: "weekly",
			}
			if v.UpdatedAt.Valid {
				u.LastMod = v.UpdatedAt.Time.Format(time.DateOnly)
			}
			urls = append(urls, u)
		}
	}

	sitemap := sitemapURLSet{
		XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write([]byte(xml.Header))
	xml.NewEncoder(w).Encode(sitemap)
}

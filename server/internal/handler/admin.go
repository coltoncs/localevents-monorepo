package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/store"
)

type AdminHandler struct {
	queries *store.Queries
}

func NewAdminHandler(q *store.Queries) *AdminHandler {
	return &AdminHandler{queries: q}
}

type adminStatsResponse struct {
	TotalUsers          int64              `json:"total_users"`
	NewUsersThisWeek    int64              `json:"new_users_this_week"`
	WeeklyActiveUsers   int64              `json:"weekly_active_users"`
	EmailSubscribers    int64              `json:"email_subscribers"`
	SMSSubscribers      int64              `json:"sms_subscribers"`
	TotalUpcomingEvents int64              `json:"total_upcoming_events"`
	TotalVenues         int64              `json:"total_venues"`
	TotalSavedEvents    int64              `json:"total_saved_events"`
	PendingSuggestions  int64              `json:"pending_suggestions"`
	PendingApplications int64              `json:"pending_applications"`
	EventsBySource      []eventSourceCount `json:"events_by_source"`
	Authors             []authorWithEvents `json:"authors"`
	RecentDigests       digestStats        `json:"recent_digests"`
	LastScrape          *cronLogEntry      `json:"last_scrape"`
	LastCleanup         *cronLogEntry      `json:"last_cleanup"`
}

type eventSourceCount struct {
	Source string `json:"source"`
	Count  int64  `json:"count"`
}

type authorWithEvents struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	EventCount int64  `json:"event_count"`
}

type digestStats struct {
	Sent                int64 `json:"sent"`
	Failed              int64 `json:"failed"`
	TotalEventsIncluded int64 `json:"total_events_included"`
}

type cronLogEntry struct {
	RanAt         string         `json:"ran_at"`
	ItemsAffected int            `json:"items_affected"`
	Details       map[string]any `json:"details,omitempty"`
}

func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	resp := adminStatsResponse{}

	if v, err := h.queries.AdminCountUsers(ctx); err == nil {
		resp.TotalUsers = v
	} else {
		log.Printf("admin stats: AdminCountUsers: %v", err)
	}

	if v, err := h.queries.AdminCountNewUsersThisWeek(ctx); err == nil {
		resp.NewUsersThisWeek = v
	} else {
		log.Printf("admin stats: AdminCountNewUsersThisWeek: %v", err)
	}

	if v, err := h.queries.AdminCountWeeklyActiveUsers(ctx); err == nil {
		resp.WeeklyActiveUsers = v
	} else {
		log.Printf("admin stats: AdminCountWeeklyActiveUsers: %v", err)
	}

	if v, err := h.queries.AdminCountEmailSubscribers(ctx); err == nil {
		resp.EmailSubscribers = v
	} else {
		log.Printf("admin stats: AdminCountEmailSubscribers: %v", err)
	}

	if v, err := h.queries.AdminCountSMSSubscribers(ctx); err == nil {
		resp.SMSSubscribers = v
	} else {
		log.Printf("admin stats: AdminCountSMSSubscribers: %v", err)
	}

	if v, err := h.queries.AdminCountUpcomingEvents(ctx); err == nil {
		resp.TotalUpcomingEvents = v
	} else {
		log.Printf("admin stats: AdminCountUpcomingEvents: %v", err)
	}

	if v, err := h.queries.AdminCountVenues(ctx); err == nil {
		resp.TotalVenues = v
	} else {
		log.Printf("admin stats: AdminCountVenues: %v", err)
	}

	if v, err := h.queries.AdminCountSavedEvents(ctx); err == nil {
		resp.TotalSavedEvents = v
	} else {
		log.Printf("admin stats: AdminCountSavedEvents: %v", err)
	}

	if v, err := h.queries.AdminCountPendingSuggestions(ctx); err == nil {
		resp.PendingSuggestions = v
	} else {
		log.Printf("admin stats: AdminCountPendingSuggestions: %v", err)
	}

	if v, err := h.queries.AdminCountPendingApplications(ctx); err == nil {
		resp.PendingApplications = v
	} else {
		log.Printf("admin stats: AdminCountPendingApplications: %v", err)
	}

	if rows, err := h.queries.AdminEventsBySource(ctx); err == nil {
		for _, row := range rows {
			resp.EventsBySource = append(resp.EventsBySource, eventSourceCount{
				Source: row.Source,
				Count:  row.Count,
			})
		}
	} else {
		log.Printf("admin stats: AdminEventsBySource: %v", err)
	}
	if resp.EventsBySource == nil {
		resp.EventsBySource = []eventSourceCount{}
	}

	if rows, err := h.queries.AdminListAuthorsWithEventCounts(ctx); err == nil {
		for _, row := range rows {
			resp.Authors = append(resp.Authors, authorWithEvents{
				Name:       row.Name,
				Email:      row.Email,
				EventCount: row.EventCount,
			})
		}
	} else {
		log.Printf("admin stats: AdminListAuthorsWithEventCounts: %v", err)
	}
	if resp.Authors == nil {
		resp.Authors = []authorWithEvents{}
	}

	if row, err := h.queries.AdminRecentDigestStats(ctx); err == nil {
		resp.RecentDigests = digestStats{
			Sent:                row.Sent,
			Failed:              row.Failed,
			TotalEventsIncluded: row.TotalEventsIncluded,
		}
	} else {
		log.Printf("admin stats: AdminRecentDigestStats: %v", err)
	}

	if row, err := h.queries.GetLatestCronLog(ctx, "scrape"); err == nil {
		entry := cronLogEntry{
			RanAt:         row.RanAt.Time.Format(time.RFC3339),
			ItemsAffected: int(row.ItemsAffected),
		}
		if row.Details != nil {
			json.Unmarshal(row.Details, &entry.Details)
		}
		resp.LastScrape = &entry
	}

	if row, err := h.queries.GetLatestCronLog(ctx, "cleanup"); err == nil {
		entry := cronLogEntry{
			RanAt:         row.RanAt.Time.Format(time.RFC3339),
			ItemsAffected: int(row.ItemsAffected),
		}
		if row.Details != nil {
			json.Unmarshal(row.Details, &entry.Details)
		}
		resp.LastCleanup = &entry
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

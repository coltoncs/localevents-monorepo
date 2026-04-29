package store_test

import (
	"testing"

	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

func TestSaveEvent_Idempotent(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	user := testutil.CreateUser(t, q, "")
	event := testutil.CreateEvent(t, q, testutil.EventOpts{})

	// First save returns the row.
	first, err := q.SaveEvent(ctx, store.SaveEventParams{UserID: user.ID, EventID: event.ID})
	if err != nil {
		t.Fatalf("first save: %v", err)
	}
	if !first.ID.Valid {
		t.Fatal("expected first save to return a row")
	}

	// Second save is a no-op (ON CONFLICT DO NOTHING). The query returns no
	// row, which surfaces as ErrNoRows; either way, the count must remain 1.
	_, _ = q.SaveEvent(ctx, store.SaveEventParams{UserID: user.ID, EventID: event.ID})

	count, err := q.GetEventSaveCount(ctx, event.ID)
	if err != nil {
		t.Fatalf("save count: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected save count 1 after duplicate save, got %d", count)
	}
}

func TestSaveEvent_ListAndUnsave(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	user := testutil.CreateUser(t, q, "")
	a := testutil.CreateEvent(t, q, testutil.EventOpts{Title: "A"})
	b := testutil.CreateEvent(t, q, testutil.EventOpts{Title: "B"})

	for _, e := range []store.Event{a, b} {
		if _, err := q.SaveEvent(ctx, store.SaveEventParams{UserID: user.ID, EventID: e.ID}); err != nil {
			t.Fatalf("save %s: %v", e.Title, err)
		}
	}

	saved, err := q.ListSavedEvents(ctx, user.ID)
	if err != nil {
		t.Fatalf("list saved: %v", err)
	}
	if len(saved) != 2 {
		t.Fatalf("expected 2 saved events, got %d", len(saved))
	}

	if err := q.UnsaveEvent(ctx, store.UnsaveEventParams{UserID: user.ID, EventID: a.ID}); err != nil {
		t.Fatalf("unsave: %v", err)
	}

	saved, err = q.ListSavedEvents(ctx, user.ID)
	if err != nil {
		t.Fatalf("list after unsave: %v", err)
	}
	if len(saved) != 1 || saved[0].Title != "B" {
		t.Fatalf("expected only B remaining, got %+v", saved)
	}
}

func TestGetEventSaveCount_PerEvent(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	u1 := testutil.CreateUser(t, q, "")
	u2 := testutil.CreateUser(t, q, "")
	popular := testutil.CreateEvent(t, q, testutil.EventOpts{Title: "popular"})
	lonely := testutil.CreateEvent(t, q, testutil.EventOpts{Title: "lonely"})

	for _, u := range []store.User{u1, u2} {
		if _, err := q.SaveEvent(ctx, store.SaveEventParams{UserID: u.ID, EventID: popular.ID}); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	if got, _ := q.GetEventSaveCount(ctx, popular.ID); got != 2 {
		t.Fatalf("popular: expected 2, got %d", got)
	}
	if got, _ := q.GetEventSaveCount(ctx, lonely.ID); got != 0 {
		t.Fatalf("lonely: expected 0, got %d", got)
	}
}

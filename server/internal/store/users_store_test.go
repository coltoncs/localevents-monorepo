package store_test

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coltonsweeney/localevents/server/internal/store"
	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

func TestUpsertUser_Idempotent(t *testing.T) {
	ctx, q := testutil.NewTx(t)

	first, err := q.UpsertUser(ctx, store.UpsertUserParams{
		ClerkID: "user_upsert_1",
		Email:   pgtype.Text{String: "first@example.com", Valid: true},
	})
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Second upsert with a new email should preserve the same row id.
	second, err := q.UpsertUser(ctx, store.UpsertUserParams{
		ClerkID: "user_upsert_1",
		Email:   pgtype.Text{String: "second@example.com", Valid: true},
	})
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("expected same row, got %v vs %v", second.ID, first.ID)
	}
	if second.Email.String != "second@example.com" {
		t.Fatalf("email not updated, got %q", second.Email.String)
	}
}

func TestUpdateUserSettings_PersistsCoordinates(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	u := testutil.CreateUser(t, q, "")

	updated, err := q.UpdateUserSettings(ctx, store.UpdateUserSettingsParams{
		ID:                 u.ID,
		DefaultLatitude:    pgtype.Float8{Float64: 40.7128, Valid: true},
		DefaultLongitude:   pgtype.Float8{Float64: -74.0060, Valid: true},
		DefaultRadiusMiles: pgtype.Int4{Int32: 50, Valid: true},
	})
	if err != nil {
		t.Fatalf("update settings: %v", err)
	}
	if !updated.DefaultLatitude.Valid || updated.DefaultLatitude.Float64 != 40.7128 {
		t.Fatalf("latitude not persisted: %+v", updated.DefaultLatitude)
	}
	if !updated.DefaultRadiusMiles.Valid || updated.DefaultRadiusMiles.Int32 != 50 {
		t.Fatalf("radius not persisted: %+v", updated.DefaultRadiusMiles)
	}
}

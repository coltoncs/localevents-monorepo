package testutil_test

import (
	"testing"

	"github.com/coltonsweeney/localevents/server/internal/testutil"
)

func TestSetupSmoke(t *testing.T) {
	ctx, q := testutil.NewTx(t)
	u := testutil.CreateUser(t, q, "")
	if u.ClerkID == "" {
		t.Fatal("expected user clerk id to be set")
	}
	got, err := q.GetUserByClerkID(ctx, u.ClerkID)
	if err != nil {
		t.Fatalf("GetUserByClerkID: %v", err)
	}
	if got.ID != u.ID {
		t.Fatalf("user mismatch: got %v want %v", got.ID, u.ID)
	}
}

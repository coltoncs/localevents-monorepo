package testutil

import (
	"context"
	"net/http"

	"github.com/coltonsweeney/localevents/server/internal/middleware"
)

// WithClerkID returns a copy of r with the given Clerk user ID injected into
// request context, mimicking what RequireAuth/OptionalAuth would do on a
// successful JWT verification. Lets handler tests skip the live Clerk SDK call.
func WithClerkID(r *http.Request, clerkID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.ClerkUserIDKey, clerkID)
	return r.WithContext(ctx)
}

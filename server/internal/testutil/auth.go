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

// WithClerkIDAndRole is WithClerkID plus a Role override, so handler tests
// can exercise endpoints behind RequireRole / CanCreateEvent without
// hitting Clerk's user API.
func WithClerkIDAndRole(r *http.Request, clerkID string, role middleware.Role) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.ClerkUserIDKey, clerkID)
	ctx = context.WithValue(ctx, middleware.RoleContextKey, role)
	return r.WithContext(ctx)
}

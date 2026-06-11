package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

type contextKey string

const ClerkUserIDKey contextKey = "clerkUserID"

// ClerkFeaturesKey holds the user's enabled billing features (entitlements),
// parsed from the session token's `fea` claim with scope prefixes stripped.
const ClerkFeaturesKey contextKey = "clerkFeatures"

// billingClaims captures Clerk billing claims the SDK does not map onto
// SessionClaims. `fea` is a comma-separated list of enabled features, each
// scoped like "u:feature_events" (user) or "o:feature_events" (org).
type billingClaims struct {
	Features string `json:"fea"`
}

func GetClerkUserID(ctx context.Context) string {
	if v, ok := ctx.Value(ClerkUserIDKey).(string); ok {
		return v
	}
	return ""
}

// GetClerkFeatures returns the enabled billing features for the request, or nil.
func GetClerkFeatures(ctx context.Context) []string {
	if v, ok := ctx.Value(ClerkFeaturesKey).([]string); ok {
		return v
	}
	return nil
}

// HasFeature reports whether the request's user has the given billing feature
// entitlement (e.g. "feature_events").
func HasFeature(ctx context.Context, feature string) bool {
	for _, f := range GetClerkFeatures(ctx) {
		if f == feature {
			return true
		}
	}
	return false
}

// parseFeatures splits the `fea` claim into bare feature names, dropping the
// "u:"/"o:" scope prefix Clerk adds to each entry.
func parseFeatures(fea string) []string {
	if fea == "" {
		return nil
	}
	parts := strings.Split(fea, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if i := strings.IndexByte(p, ':'); i >= 0 {
			p = p[i+1:]
		}
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func OptionalAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				next.ServeHTTP(w, r)
				return
			}

			bc := &billingClaims{}
			claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{
				Token:                   token,
				CustomClaimsConstructor: func(context.Context) any { return bc },
			})
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), ClerkUserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, ClerkFeaturesKey, parseFeatures(bc.Features))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				metrics.AuthFailuresTotal.WithLabelValues("missing_token").Inc()
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			bc := &billingClaims{}
			claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{
				Token:                   token,
				CustomClaimsConstructor: func(context.Context) any { return bc },
			})
			if err != nil {
				metrics.AuthFailuresTotal.WithLabelValues("invalid_token").Inc()
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ClerkUserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, ClerkFeaturesKey, parseFeatures(bc.Features))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

// SetClerkAPIKey sets the Clerk API key for SDK operations.
func SetClerkAPIKey(key string) {
	clerk.SetKey(key)
}

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

func GetClerkUserID(ctx context.Context) string {
	if v, ok := ctx.Value(ClerkUserIDKey).(string); ok {
		return v
	}
	return ""
}

func OptionalAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				next.ServeHTTP(w, r)
				return
			}

			claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{Token: token})
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), ClerkUserIDKey, claims.Subject)
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

			claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{Token: token})
			if err != nil {
				metrics.AuthFailuresTotal.WithLabelValues("invalid_token").Inc()
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ClerkUserIDKey, claims.Subject)
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

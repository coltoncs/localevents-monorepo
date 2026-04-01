package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/coltonsweeney/localevents/server/internal/metrics"
)

type Role string

const (
	RoleUser   Role = "user"
	RoleAuthor Role = "author"
	RoleAdmin  Role = "admin"
)

type publicMetadata struct {
	Role string `json:"role"`
}

func GetUserRole(ctx context.Context, clerkUserID string) (Role, error) {
	u, err := clerkuser.Get(ctx, clerkUserID)
	if err != nil {
		return RoleUser, err
	}

	if u.PublicMetadata == nil {
		return RoleUser, nil
	}

	var meta publicMetadata
	if err := json.Unmarshal(u.PublicMetadata, &meta); err != nil {
		return RoleUser, nil
	}

	switch Role(meta.Role) {
	case RoleAuthor:
		return RoleAuthor, nil
	case RoleAdmin:
		return RoleAdmin, nil
	default:
		return RoleUser, nil
	}
}

func SetUserRole(ctx context.Context, clerkUserID string, role Role) error {
	meta, err := json.Marshal(publicMetadata{Role: string(role)})
	if err != nil {
		return err
	}

	_, err = clerkuser.Update(ctx, clerkUserID, &clerkuser.UpdateParams{
		PublicMetadata: (*json.RawMessage)(&meta),
	})
	return err
}

func RequireRole(roles ...Role) func(http.Handler) http.Handler {
	allowed := make(map[Role]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clerkID := GetClerkUserID(r.Context())
			if clerkID == "" {
				metrics.AuthFailuresTotal.WithLabelValues("missing_clerk_id").Inc()
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			role, err := GetUserRole(r.Context(), clerkID)
			if err != nil {
				metrics.AuthFailuresTotal.WithLabelValues("role_check_error").Inc()
				http.Error(w, `{"error":"failed to check role"}`, http.StatusInternalServerError)
				return
			}

			if !allowed[role] {
				metrics.AuthFailuresTotal.WithLabelValues("insufficient_role").Inc()
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func CanCreateEvent(role Role) bool {
	return role == RoleAuthor || role == RoleAdmin
}

func CanModifyEvent(role Role, eventOwnerClerkID, requestingClerkID string) bool {
	if role == RoleAdmin {
		return true
	}
	return role == RoleAuthor && eventOwnerClerkID == requestingClerkID
}

func CanManageAuthors(role Role) bool {
	return role == RoleAdmin
}

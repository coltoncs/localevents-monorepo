package billing

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type subscriptionResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// HasActiveSubscription checks if a Clerk user has an active billing subscription.
func HasActiveSubscription(clerkSecretKey, clerkUserID string) (bool, error) {
	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s/billing/subscription", clerkUserID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("clerk billing request: %w", err)
	}
	defer resp.Body.Close()

	// 404 or other error means no subscription
	if resp.StatusCode != http.StatusOK {
		return false, nil
	}

	var sub subscriptionResponse
	if err := json.NewDecoder(resp.Body).Decode(&sub); err != nil {
		return false, fmt.Errorf("decode subscription: %w", err)
	}

	return sub.Status == "active", nil
}

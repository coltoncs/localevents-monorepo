package billing

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type planResponse struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
}

type subscriptionItemResponse struct {
	Plan planResponse `json:"plan"`
}

type subscriptionResponse struct {
	ID                string                     `json:"id"`
	Status            string                     `json:"status"`
	SubscriptionItems []subscriptionItemResponse `json:"subscription_items"`
}

// HasActiveSubscription checks if a Clerk user has an active *paid* billing subscription.
// Free-tier subscriptions (amount == 0) are not considered active for gating purposes.
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

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("read response body: %w", err)
	}

	// 404 or other error means no subscription
	if resp.StatusCode != http.StatusOK {
		return false, nil
	}

	var sub subscriptionResponse
	if err := json.Unmarshal(body, &sub); err != nil {
		return false, fmt.Errorf("decode subscription: %w", err)
	}

	planSlug := ""
	if len(sub.SubscriptionItems) > 0 {
		planSlug = sub.SubscriptionItems[0].Plan.Slug
	}
	return sub.Status == "active" && planSlug == "donate", nil
}

package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/coltonsweeney/localevents/server/internal/middleware"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: set-admin <clerk_user_id>\n")
		os.Exit(1)
	}

	clerkUserID := os.Args[1]

	secretKey := os.Getenv("CLERK_SECRET_KEY")
	if secretKey == "" {
		log.Fatal("CLERK_SECRET_KEY environment variable is required")
	}

	clerk.SetKey(secretKey)

	ctx := context.Background()
	if err := middleware.SetUserRole(ctx, clerkUserID, middleware.RoleAdmin); err != nil {
		log.Fatalf("Failed to set admin role: %v", err)
	}

	fmt.Printf("Successfully set user %s as admin\n", clerkUserID)
}

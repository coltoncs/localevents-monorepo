package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL         string
	ClerkSecretKey      string
	Port                string
	CORSOrigins         string
	TicketmasterAPIKey  string
	SeatGeekClientID    string
	BandsintownAppID    string
	ScraperCronSchedule string
	ScraperEnabled      bool
	R2AccountID         string
	R2AccessKeyID       string
	R2SecretAccessKey   string
	R2PublicURL         string
	R2Bucket            string
	ResendAPIKey        string
	TwilioAccountSID    string
	TwilioAuthToken     string
	TwilioFromNumber    string
	DigestCronSchedule  string
	DigestEnabled       bool
	CleanupCronSchedule string
	FrontendURL         string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/localevents?sslmode=disable"),
		ClerkSecretKey:      getEnv("CLERK_SECRET_KEY", "sk_test_Tq1fYDEweXJvFsLNwWMYOyBkwK15BqvUt1MegBgqbO"),
		Port:                getEnv("PORT", "8080"),
		CORSOrigins:         getEnv("CORS_ORIGINS", "http://localhost:3000"),
		TicketmasterAPIKey:  getEnv("TICKETMASTER_API_KEY", ""),
		SeatGeekClientID:    getEnv("SEATGEEK_CLIENT_ID", ""),
		BandsintownAppID:    getEnv("BANDSINTOWN_APP_ID", ""),
		ScraperCronSchedule: getEnv("SCRAPER_CRON_SCHEDULE", "0 */6 * * *"),
		ScraperEnabled:      getEnv("SCRAPER_ENABLED", "true") == "true",
		R2AccountID:         getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:       getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:   getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2PublicURL:         getEnv("R2_PUBLIC_URL", ""),
		R2Bucket:            getEnv("R2_BUCKET", "localevents-images"),
		ResendAPIKey:        getEnv("RESEND_API_KEY", ""),
		TwilioAccountSID:    getEnv("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:     getEnv("TWILIO_AUTH_TOKEN", ""),
		TwilioFromNumber:    getEnv("TWILIO_FROM_NUMBER", ""),
		DigestCronSchedule:  getEnv("DIGEST_CRON_SCHEDULE", "CRON_TZ=America/New_York 0 9 * * 5"),
		DigestEnabled:       getEnv("DIGEST_ENABLED", "false") == "true",
		// Runs one hour before the digest so digest emails only reference
		// images that will survive until the following week's cleanup.
		CleanupCronSchedule: getEnv("CLEANUP_CRON_SCHEDULE", "CRON_TZ=America/New_York 0 8 * * 5"),
		FrontendURL:         getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

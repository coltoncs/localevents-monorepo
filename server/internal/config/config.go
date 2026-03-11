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
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Command embed-backfill embeds every event missing a row in
// event_embeddings, in batches. Safe to re-run; rows already present are
// skipped.
package main

import (
	"context"
	"flag"
	"log"
	"time"

	"github.com/coltonsweeney/localevents/server/internal/config"
	"github.com/coltonsweeney/localevents/server/internal/database"
	"github.com/coltonsweeney/localevents/server/internal/embedding"
	"github.com/google/uuid"
)

func main() {
	pageSize := flag.Int("page", 200, "events to fetch per DB page")
	maxPages := flag.Int("max-pages", 0, "stop after this many pages (0 = no limit)")
	flag.Parse()

	cfg := config.Load()
	if cfg.OpenAIAPIKey == "" {
		log.Fatal("OPENAI_API_KEY not set")
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	client := embedding.NewClient(cfg.OpenAIAPIKey)
	store := embedding.NewStore(pool)

	totalEvents := 0
	start := time.Now()
	for page := 0; ; page++ {
		if *maxPages > 0 && page >= *maxPages {
			break
		}
		pending, err := store.ListUnembedded(ctx, *pageSize)
		if err != nil {
			log.Fatalf("list unembedded: %v", err)
		}
		if len(pending) == 0 {
			break
		}

		for batchStart := 0; batchStart < len(pending); batchStart += embedding.MaxBatch {
			end := batchStart + embedding.MaxBatch
			if end > len(pending) {
				end = len(pending)
			}
			batch := pending[batchStart:end]

			inputs := make([]string, len(batch))
			for i, e := range batch {
				inputs[i] = embedding.EventInput{
					Title:       e.Title,
					Description: e.Description,
					Categories:  e.Categories,
					VenueName:   e.VenueName,
					City:        e.City,
				}.String()
			}

			vecs, err := client.Embed(ctx, inputs)
			if err != nil {
				log.Printf("embed batch failed: %v (sleeping 5s and retrying once)", err)
				time.Sleep(5 * time.Second)
				vecs, err = client.Embed(ctx, inputs)
				if err != nil {
					log.Fatalf("retry failed: %v", err)
				}
			}

			ids := make([]uuid.UUID, len(batch))
			for i, e := range batch {
				ids[i] = e.ID
			}
			if err := store.UpsertEmbeddings(ctx, ids, vecs); err != nil {
				log.Fatalf("upsert: %v", err)
			}
			totalEvents += len(batch)
			log.Printf("embedded %d (running total: %d)", len(batch), totalEvents)
		}
	}

	log.Printf("done: %d events embedded in %s", totalEvents, time.Since(start))
}

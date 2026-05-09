package embedding

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
)

// Store is a thin wrapper over the connection pool for vector reads/writes
// that sqlc cannot codegen.
type Store struct {
	Pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{Pool: pool}
}

// UnembeddedEvent is an event that needs an embedding generated.
type UnembeddedEvent struct {
	ID          uuid.UUID
	Title       string
	Description string
	VenueName   string
	City        string
	Categories  []string
}

// ListUnembedded returns events with no row in event_embeddings, oldest first
// so backfill makes steady forward progress instead of churning recent events.
func (s *Store) ListUnembedded(ctx context.Context, limit int) ([]UnembeddedEvent, error) {
	const q = `
		SELECT e.id, e.title, COALESCE(e.description, ''),
		       COALESCE(e.venue_name, ''), COALESCE(e.city, ''),
		       COALESCE(e.categories, ARRAY[]::text[])
		FROM events e
		LEFT JOIN event_embeddings ee ON ee.event_id = e.id
		WHERE ee.event_id IS NULL
		ORDER BY e.created_at ASC
		LIMIT $1
	`
	rows, err := s.Pool.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("query unembedded: %w", err)
	}
	defer rows.Close()

	var out []UnembeddedEvent
	for rows.Next() {
		var e UnembeddedEvent
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.VenueName, &e.City, &e.Categories); err != nil {
			return nil, fmt.Errorf("scan unembedded: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// UpsertEmbeddings writes one row per (id, vector) pair. Vectors must be
// non-nil and the same length.
func (s *Store) UpsertEmbeddings(ctx context.Context, ids []uuid.UUID, vectors [][]float32) error {
	if len(ids) != len(vectors) {
		return fmt.Errorf("ids/vectors length mismatch: %d vs %d", len(ids), len(vectors))
	}
	if len(ids) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i, id := range ids {
		batch.Queue(`
			INSERT INTO event_embeddings (event_id, embedding, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (event_id) DO UPDATE
				SET embedding = EXCLUDED.embedding, updated_at = NOW()
		`, id, pgvector.NewVector(vectors[i]))
	}

	br := s.Pool.SendBatch(ctx, batch)
	defer br.Close()
	for range ids {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upsert embedding: %w", err)
		}
	}
	return nil
}

// MarkAllUsersForRecompute is called when the embedding model or input
// format changes and every user vector becomes stale.
func (s *Store) MarkAllUsersForRecompute(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `UPDATE user_preferences SET needs_recompute = TRUE`)
	return err
}

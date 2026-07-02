package search

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/coltonsweeney/localevents/server/internal/embedding"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

type Service struct {
	pool     *pgxpool.Pool
	client   *embedding.Client
	embStore *embedding.Store
}

func New(client *embedding.Client, pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, client: client, embStore: embedding.NewStore(pool)}
}

type Params struct {
	Lat, Lng     float64
	RadiusMeters float64
	StartDate    time.Time
	EndDate      time.Time
	Category     pgtype.Text
	Genre        pgtype.Text
	VenueName    pgtype.Text
	VenueID      pgtype.UUID
	Limit        int32
	Offset       int32
}

const baseFrom = `
	FROM events e
	LEFT JOIN event_embeddings ee ON ee.event_id = e.id
	WHERE ST_DWithin(
	    ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
	    ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326)::geography,
	    $3::float
	)
	AND e.start_time >= $4
	AND e.start_time < $5
	AND ($6::text IS NULL OR $6::text = ANY(e.categories))
	AND ($7::text IS NULL OR $7::text = ANY(e.genre))
	AND ($8::text IS NULL OR e.venue_name = $8::text)
	AND ($9::uuid IS NULL OR e.venue_id = $9::uuid)
`

// Hybrid combines exact/lexical matching with semantic (vector) ranking.
// It embeds the query, counts all matching events, then returns a page of
// results ordered exact-first: literal title/venue hits float to the top
// (title equality, then title prefix, then any title/venue substring), and
// everything else is ordered by cosine similarity to the query vector.
//
// The join to event_embeddings is a LEFT join so events without an embedding
// yet (e.g. just-created events awaiting the backfill) still surface via the
// lexical tiers; they sort last within the semantic tier (NULLS LAST).
func (s *Service) Hybrid(ctx context.Context, query string, p Params) ([]store.Event, int64, error) {
	vecs, err := s.client.Embed(ctx, []string{query})
	if err != nil {
		return nil, 0, fmt.Errorf("embed query: %w", err)
	}
	queryVec := pgvector.NewVector(vecs[0])

	args := []any{
		p.Lng, p.Lat, p.RadiusMeters,
		p.StartDate, p.EndDate,
		nullText(p.Category),
		nullText(p.Genre),
		nullText(p.VenueName),
		nullUUID(p.VenueID),
	}

	var total int64
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) "+baseFrom, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count hybrid search: %w", err)
	}

	const selectCols = `SELECT e.id, e.external_id, e.source, e.title, e.description,
		e.venue_name, e.address, e.city, e.state, e.zip,
		e.latitude, e.longitude, e.start_time, e.end_time,
		e.image_url, e.ticket_url, e.price_min, e.price_max,
		e.submitted_by, e.created_at, e.updated_at, e.manually_edited,
		e.venue_id, e.categories, e.series_id, e.is_free,
		e.is_featured, e.featured_at, e.featured_by, e.genre `

	// $10 query vector, $11 raw query (exact), $12 prefix pattern, $13
	// substring pattern, $14 limit, $15 offset. The lexical tier ranks
	// exact title matches highest, then title prefixes, then any title or
	// venue substring; a score of 0 means "no lexical hit, semantic only".
	const orderBy = `
		ORDER BY
			CASE
				WHEN lower(e.title) = lower($11) THEN 3
				WHEN e.title ILIKE $12 THEN 2
				WHEN e.title ILIKE $13 OR e.venue_name ILIKE $13 THEN 1
				ELSE 0
			END DESC,
			(ee.embedding <=> $10) ASC NULLS LAST
		LIMIT $14 OFFSET $15`

	listArgs := append(args,
		queryVec,
		query,
		query+"%",
		"%"+query+"%",
		p.Limit, p.Offset,
	)
	rows, err := s.pool.Query(ctx, selectCols+baseFrom+orderBy, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query hybrid search: %w", err)
	}
	defer rows.Close()

	var events []store.Event
	for rows.Next() {
		var e store.Event
		if err := rows.Scan(
			&e.ID, &e.ExternalID, &e.Source, &e.Title, &e.Description,
			&e.VenueName, &e.Address, &e.City, &e.State, &e.Zip,
			&e.Latitude, &e.Longitude, &e.StartTime, &e.EndTime,
			&e.ImageUrl, &e.TicketUrl, &e.PriceMin, &e.PriceMax,
			&e.SubmittedBy, &e.CreatedAt, &e.UpdatedAt, &e.ManuallyEdited,
			&e.VenueID, &e.Categories, &e.SeriesID, &e.IsFree,
			&e.IsFeatured, &e.FeaturedAt, &e.FeaturedBy, &e.Genre,
		); err != nil {
			return nil, 0, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	return events, total, rows.Err()
}

// IndexEvent embeds a single event and upserts its vector immediately, so a
// newly created or edited event is semantically searchable without waiting
// for the periodic backfill. Safe to call in a goroutine; errors are the
// caller's to log. A nil service or client is a no-op.
func (s *Service) IndexEvent(ctx context.Context, id uuid.UUID, in embedding.EventInput) error {
	if s == nil || s.client == nil {
		return nil
	}
	vecs, err := s.client.Embed(ctx, []string{in.String()})
	if err != nil {
		return fmt.Errorf("embed event: %w", err)
	}
	if err := s.embStore.UpsertEmbeddings(ctx, []uuid.UUID{id}, vecs); err != nil {
		return fmt.Errorf("upsert event embedding: %w", err)
	}
	return nil
}

func nullText(t pgtype.Text) any {
	if !t.Valid {
		return nil
	}
	return t.String
}

func nullUUID(u pgtype.UUID) any {
	if !u.Valid {
		return nil
	}
	return u.Bytes
}

// Package recommend produces personalized event recommendations from
// pgvector embeddings and a user's interaction history.
package recommend

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
)

// MinSignalsForRecs is the cold-start threshold. Below this, callers should
// fall back to trending events.
const MinSignalsForRecs = 5

const (
	saveWeight     = 1.0
	viewWeight     = 0.2
	signalHalfLife = 90 * 24 * time.Hour // signals decay by half over 90 days
)

type Service struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{Pool: pool}
}

// signal is one piece of evidence about a user's taste — a save or a view
// of a particular event, with a recency timestamp used for time-decay.
type signal struct {
	embedding []float32
	weight    float64
	at        time.Time
}

// RecomputeUser builds the user's preference vector as a time-decayed,
// weighted centroid of the embeddings of events they've saved and viewed,
// then writes it into user_preferences. Returns the number of distinct
// events that contributed to the centroid.
func (s *Service) RecomputeUser(ctx context.Context, userID uuid.UUID) (int, error) {
	const q = `
		SELECT ee.embedding, src.weight, src.at
		FROM (
			SELECT event_id, $2::float AS weight, created_at AS at
			FROM saved_events WHERE user_id = $1
			UNION ALL
			SELECT event_id, $3::float AS weight, viewed_at AS at
			FROM event_views WHERE user_id = $1
		) src
		JOIN event_embeddings ee ON ee.event_id = src.event_id
	`
	rows, err := s.Pool.Query(ctx, q, userID, saveWeight, viewWeight)
	if err != nil {
		return 0, fmt.Errorf("query user signals: %w", err)
	}
	defer rows.Close()

	var sigs []signal
	for rows.Next() {
		var v pgvector.Vector
		var sig signal
		if err := rows.Scan(&v, &sig.weight, &sig.at); err != nil {
			return 0, fmt.Errorf("scan signal: %w", err)
		}
		sig.embedding = v.Slice()
		sigs = append(sigs, sig)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	if len(sigs) == 0 {
		// No signals yet — clear any stale vector and mark not-recompute.
		_, err := s.Pool.Exec(ctx, `
			INSERT INTO user_preferences (user_id, preference_vector, signal_count, needs_recompute, updated_at)
			VALUES ($1, NULL, 0, FALSE, NOW())
			ON CONFLICT (user_id) DO UPDATE
				SET preference_vector = NULL, signal_count = 0,
				    needs_recompute = FALSE, updated_at = NOW()
		`, userID)
		return 0, err
	}

	centroid := weightedCentroid(sigs)
	now := time.Now()

	_, err = s.Pool.Exec(ctx, `
		INSERT INTO user_preferences (user_id, preference_vector, signal_count, needs_recompute, updated_at)
		VALUES ($1, $2, $3, FALSE, $4)
		ON CONFLICT (user_id) DO UPDATE
			SET preference_vector = EXCLUDED.preference_vector,
			    signal_count = EXCLUDED.signal_count,
			    needs_recompute = FALSE,
			    updated_at = EXCLUDED.updated_at
	`, userID, pgvector.NewVector(centroid), len(sigs), now)
	if err != nil {
		return 0, fmt.Errorf("upsert user preferences: %w", err)
	}
	return len(sigs), nil
}

// weightedCentroid sums each signal's embedding scaled by weight × time-decay,
// then L2-normalizes. Vectors from text-embedding-3-small are unit-length,
// so re-normalizing keeps the centroid on the same scale and makes cosine
// similarity comparisons consistent.
func weightedCentroid(sigs []signal) []float32 {
	dim := len(sigs[0].embedding)
	sum := make([]float64, dim)
	now := time.Now()

	for _, s := range sigs {
		decay := math.Exp(-math.Ln2 * now.Sub(s.at).Seconds() / signalHalfLife.Seconds())
		w := s.weight * decay
		for i, v := range s.embedding {
			sum[i] += float64(v) * w
		}
	}

	var norm float64
	for _, v := range sum {
		norm += v * v
	}
	norm = math.Sqrt(norm)
	out := make([]float32, dim)
	if norm == 0 {
		return out
	}
	for i, v := range sum {
		out[i] = float32(v / norm)
	}
	return out
}

// RecomputeStale finds users whose preference vector is marked stale and
// recomputes each one. Intended to be called from a nightly cron.
func (s *Service) RecomputeStale(ctx context.Context, maxUsers int) (int, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT user_id FROM user_preferences
		WHERE needs_recompute = TRUE
		ORDER BY updated_at ASC
		LIMIT $1
	`, maxUsers)
	if err != nil {
		return 0, err
	}
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, err
		}
		ids = append(ids, id)
	}
	rows.Close()

	done := 0
	for _, id := range ids {
		if _, err := s.RecomputeUser(ctx, id); err != nil {
			return done, fmt.Errorf("recompute user %s: %w", id, err)
		}
		done++
	}
	return done, nil
}

// Candidate is one event under consideration for recommendation, with its
// embedding vector kept around for MMR diversity scoring.
type Candidate struct {
	EventID    uuid.UUID
	Score      float64 // cosine similarity to user vector, in [-1, 1]
	embedding  []float32
}

// FetchCandidates pulls the top-K events by cosine similarity to the user's
// preference vector, scoped to upcoming events within `radiusMeters` of
// (lat, lng), excluding events the user already saved.
func (s *Service) FetchCandidates(
	ctx context.Context,
	userID uuid.UUID,
	lat, lng, radiusMeters float64,
	k int,
) ([]Candidate, error) {
	const q = `
		WITH u AS (
			SELECT preference_vector FROM user_preferences WHERE user_id = $1
		)
		SELECT e.id, ee.embedding,
		       1 - (ee.embedding <=> (SELECT preference_vector FROM u)) AS score
		FROM events e
		JOIN event_embeddings ee ON ee.event_id = e.id
		WHERE e.start_time > NOW()
		  AND ST_DWithin(
		      ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
		      ST_SetSRID(ST_MakePoint($3::float, $2::float), 4326)::geography,
		      $4::float
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM saved_events se
		      WHERE se.user_id = $1 AND se.event_id = e.id
		  )
		  AND (SELECT preference_vector FROM u) IS NOT NULL
		ORDER BY ee.embedding <=> (SELECT preference_vector FROM u) ASC
		LIMIT $5
	`
	rows, err := s.Pool.Query(ctx, q, userID, lat, lng, radiusMeters, k)
	if err != nil {
		return nil, fmt.Errorf("fetch candidates: %w", err)
	}
	defer rows.Close()

	var out []Candidate
	for rows.Next() {
		var c Candidate
		var v pgvector.Vector
		if err := rows.Scan(&c.EventID, &v, &c.Score); err != nil {
			return nil, err
		}
		c.embedding = v.Slice()
		out = append(out, c)
	}
	return out, rows.Err()
}

// MMR re-ranks candidates to balance relevance (similarity to the user
// vector, already in `Score`) against diversity (dissimilarity to items
// already picked). lambda=1 is pure relevance; lambda=0 is pure diversity.
// Returns up to `n` event IDs in selection order.
func MMR(candidates []Candidate, n int, lambda float64) []Candidate {
	if n > len(candidates) {
		n = len(candidates)
	}
	if n == 0 {
		return nil
	}

	picked := make([]Candidate, 0, n)
	remaining := make([]Candidate, len(candidates))
	copy(remaining, candidates)

	// First pick is always the highest-relevance candidate.
	picked = append(picked, remaining[0])
	remaining = remaining[1:]

	for len(picked) < n && len(remaining) > 0 {
		bestIdx := -1
		bestScore := math.Inf(-1)
		for i, c := range remaining {
			maxSim := math.Inf(-1)
			for _, p := range picked {
				sim := cosine(c.embedding, p.embedding)
				if sim > maxSim {
					maxSim = sim
				}
			}
			score := lambda*c.Score - (1-lambda)*maxSim
			if score > bestScore {
				bestScore = score
				bestIdx = i
			}
		}
		picked = append(picked, remaining[bestIdx])
		remaining = append(remaining[:bestIdx], remaining[bestIdx+1:]...)
	}
	return picked
}

func cosine(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		x, y := float64(a[i]), float64(b[i])
		dot += x * y
		na += x * x
		nb += y * y
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

// suppress unused warnings during partial build
var _ = pgx.ErrNoRows

// Package testutil provides shared helpers for tests against the LocalEvents
// server: a connection to the localevents_test database with migrations
// applied, transaction-per-test isolation, and fixture builders.
//
// Tests skip themselves if the test database is unreachable so the suite
// stays runnable on machines without docker-compose up.
package testutil

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/coltonsweeney/localevents/server/internal/database"
	"github.com/coltonsweeney/localevents/server/internal/store"
)

const defaultTestDBName = "localevents_test"

var (
	poolOnce sync.Once
	sharedPool *pgxpool.Pool
	poolErr  error
)

func testDBURL() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return "postgres://postgres:postgres@localhost:5432/" + defaultTestDBName + "?sslmode=disable"
}

// adminURL points at the "postgres" maintenance database so we can issue
// CREATE DATABASE for the test DB on first run.
func adminURL() string {
	u := testDBURL()
	// Replace path segment "/<dbname>" with "/postgres".
	idx := strings.LastIndex(u, "/")
	q := strings.Index(u, "?")
	if idx == -1 {
		return u
	}
	if q == -1 {
		return u[:idx] + "/postgres"
	}
	return u[:idx] + "/postgres" + u[q:]
}

func migrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "migrations"))
}

func ensureDatabase(ctx context.Context) error {
	conn, err := pgx.Connect(ctx, adminURL())
	if err != nil {
		return fmt.Errorf("connect to admin db: %w", err)
	}
	defer conn.Close(ctx)

	dbName := defaultTestDBName
	if v := os.Getenv("TEST_DATABASE_NAME"); v != "" {
		dbName = v
	}

	var exists bool
	if err := conn.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)", dbName).Scan(&exists); err != nil {
		return fmt.Errorf("check db exists: %w", err)
	}
	if !exists {
		// TEMPLATE template0 sidesteps the postgis/alpine "collation version"
		// mismatch when copying from the default template1.
		if _, err := conn.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %q TEMPLATE template0`, dbName)); err != nil {
			return fmt.Errorf("create db: %w", err)
		}
	}
	return nil
}

// Pool returns the shared *pgxpool.Pool connected to the test database with
// migrations applied. Calling t.Skip if the database is unreachable.
func Pool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	poolOnce.Do(func() {
		ctx := context.Background()
		if err := ensureDatabase(ctx); err != nil {
			poolErr = err
			return
		}
		p, err := database.Connect(ctx, testDBURL())
		if err != nil {
			poolErr = err
			return
		}
		if err := database.RunMigrations(ctx, p, migrationsDir()); err != nil {
			p.Close()
			poolErr = err
			return
		}
		sharedPool = p
	})
	if poolErr != nil {
		t.Skipf("test database unavailable (set TEST_DATABASE_URL or run docker-compose): %v", poolErr)
	}
	return sharedPool
}

// NewTx checks out a connection from the pool, begins a transaction, and
// returns a *store.Queries scoped to that transaction. The transaction is
// rolled back on test cleanup, giving each test full isolation without
// truncation.
func NewTx(t testing.TB) (context.Context, *store.Queries) {
	t.Helper()
	pool := Pool(t)
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	t.Cleanup(func() {
		_ = tx.Rollback(context.Background())
	})
	return ctx, store.New(tx)
}

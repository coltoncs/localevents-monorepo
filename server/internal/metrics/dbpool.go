package metrics

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// StartDBPoolCollector launches a goroutine that polls pgxpool.Stat every
// interval and updates the DB pool Prometheus gauges. It stops when the done
// channel is closed.
func StartDBPoolCollector(pool *pgxpool.Pool, interval time.Duration, done <-chan struct{}) {
	// Track previous cumulative values so we can use prometheus Counter.Add
	// (Counters only go up, and pgxpool gives us cumulative totals).
	var prevAcquire int64
	var prevEmpty int64
	var prevCanceled int64
	var prevAcquireDur time.Duration

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				stat := pool.Stat()

				DBPoolTotalConns.Set(float64(stat.TotalConns()))
				DBPoolIdleConns.Set(float64(stat.IdleConns()))
				DBPoolAcquiredConns.Set(float64(stat.AcquiredConns()))
				DBPoolMaxConns.Set(float64(stat.MaxConns()))

				curAcquire := stat.AcquireCount()
				if delta := curAcquire - prevAcquire; delta > 0 {
					DBPoolAcquireCount.Add(float64(delta))
				}
				prevAcquire = curAcquire

				curDur := stat.AcquireDuration()
				if delta := curDur - prevAcquireDur; delta > 0 {
					DBPoolAcquireDuration.Observe(delta.Seconds())
				}
				prevAcquireDur = curDur

				curEmpty := stat.EmptyAcquireCount()
				if delta := curEmpty - prevEmpty; delta > 0 {
					DBPoolEmptyAcquireCount.Add(float64(delta))
				}
				prevEmpty = curEmpty

				curCanceled := stat.CanceledAcquireCount()
				if delta := curCanceled - prevCanceled; delta > 0 {
					DBPoolCanceledAcquireCount.Add(float64(delta))
				}
				prevCanceled = curCanceled
			}
		}
	}()
}

package handler

import (
	"encoding/json"
	"net/http"

	"github.com/coltonsweeney/localevents/server/internal/notifier"
)

type DigestHandler struct {
	runner *notifier.Runner
}

func NewDigestHandler(runner *notifier.Runner) *DigestHandler {
	return &DigestHandler{runner: runner}
}

func (h *DigestHandler) Trigger(w http.ResponseWriter, r *http.Request) {
	if h.runner == nil {
		http.Error(w, `{"error":"digest not configured"}`, http.StatusServiceUnavailable)
		return
	}

	go h.runner.Run(r.Context())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "digest triggered"})
}

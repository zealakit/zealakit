package handler

import (
	"net/http"

	"example.com/stdlib-api-beta4/internal/presentation/http/respond"
)

// Health returns a simple readiness payload.
func Health(w http.ResponseWriter, _ *http.Request) {
	respond.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

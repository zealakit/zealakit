package respond

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// ErrorBody is the standard error payload shape for this API.
type ErrorBody struct {
	Error string `json:"error"`
}

// ErrorJSON writes a JSON error response.
func ErrorJSON(w http.ResponseWriter, status int, message string) {
	JSON(w, status, ErrorBody{Error: message})
}

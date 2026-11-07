package middleware

import (
	"log/slog"
	"net/http"

	"example.com/zealakit/stdlib-api/internal/presentation/http/respond"
)

// Recovery catches panics and returns a 500 JSON response.
func Recovery(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					logger.Error("panic recovered",
						"error", recovered,
						"method", r.Method,
						"path", r.URL.Path,
						"request_id", RequestIDFromContext(r.Context()),
					)
					respond.ErrorJSON(w, http.StatusInternalServerError, "internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

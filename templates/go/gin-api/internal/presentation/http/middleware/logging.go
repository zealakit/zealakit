package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Logging logs method, path, status, duration, and request id via slog.
// Prefer this over gin.Logger to avoid duplicate request logs.
func Logging(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		logger.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", RequestIDFromContext(c),
		)
	}
}

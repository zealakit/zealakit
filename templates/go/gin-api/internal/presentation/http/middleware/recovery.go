package middleware

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"example.com/zealakit/gin-api/internal/presentation/http/response"
)

// Recovery catches panics, logs them, and returns a generic 500 JSON body.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic recovered",
					"error", recovered,
					"method", c.Request.Method,
					"path", c.Request.URL.Path,
					"request_id", RequestIDFromContext(c),
				)
				response.Internal(c)
			}
		}()
		c.Next()
	}
}

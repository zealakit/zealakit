package middleware

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/gin-gonic/gin"
)

const (
	// RequestIDHeader is the correlation header.
	RequestIDHeader = "X-Request-ID"
	requestIDKey    = "request_id"
)

// RequestID ensures every request has a correlation id.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = newRequestID()
		}
		c.Writer.Header().Set(RequestIDHeader, id)
		c.Set(requestIDKey, id)
		c.Next()
	}
}

// RequestIDFromContext returns the request id stored by RequestID middleware.
func RequestIDFromContext(c *gin.Context) string {
	if value, ok := c.Get(requestIDKey); ok {
		if id, ok := value.(string); ok {
			return id
		}
	}
	return ""
}

func newRequestID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(buf)
}

package router

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"example.com/zealakit/gin-api/internal/presentation/http/handler"
	"example.com/zealakit/gin-api/internal/presentation/http/middleware"
)

// New builds the Gin engine with middleware and routes.
// Uses gin.New() (not Default) so logging/recovery come from our slog middleware only.
func New(logger *slog.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	engine := gin.New()
	engine.Use(
		middleware.RequestID(),
		middleware.Recovery(logger),
		middleware.Logging(logger),
	)

	engine.GET("/health", handler.Health)

	v1 := engine.Group("/api/v1")
	{
		v1.GET("/hello", handler.Hello)
	}

	return engine
}

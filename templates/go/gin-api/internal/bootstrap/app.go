package bootstrap

import (
	"context"
	"fmt"
	"log/slog"

	"example.com/zealakit/gin-api/internal/infrastructure/config"
	"example.com/zealakit/gin-api/internal/infrastructure/logging"
	httpapi "example.com/zealakit/gin-api/internal/presentation/http"
	"example.com/zealakit/gin-api/internal/presentation/http/router"
)

// App is the composition root for the HTTP API process.
type App struct {
	Config config.Config
	Logger *slog.Logger
	Server *httpapi.Server
}

// New constructs dependencies and returns a ready-to-run application.
func New() (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	logger := logging.New(cfg.LogLevel, cfg.LogFormat).With(
		"app", cfg.AppName,
		"env", cfg.Environment,
	)

	engine := router.New(logger)
	server := httpapi.NewServer(cfg, logger, engine)

	return &App{
		Config: cfg,
		Logger: logger,
		Server: server,
	}, nil
}

// Run starts the HTTP server until ctx is cancelled.
func (a *App) Run(ctx context.Context) error {
	return a.Server.Start(ctx)
}

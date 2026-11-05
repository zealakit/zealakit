package bootstrap

import (
	"context"
	"fmt"
	"log/slog"

	appworker "example.com/zealakit/stdlib-worker/internal/application/worker"
	"example.com/zealakit/stdlib-worker/internal/infrastructure/config"
	"example.com/zealakit/stdlib-worker/internal/infrastructure/logging"
	"example.com/zealakit/stdlib-worker/internal/worker"
)

// App is the composition root for the worker process.
type App struct {
	Config config.Config
	Logger *slog.Logger
	Runner *appworker.Runner
}

// New constructs dependencies and returns a ready-to-run worker application.
func New() (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	logger := logging.New(cfg.LogLevel, cfg.LogFormat).With(
		"app", cfg.AppName,
		"env", cfg.Environment,
	)

	runner := &appworker.Runner{
		Processor: appworker.ExampleProcessor{Logger: logger},
		Interval:  cfg.Interval,
		Logger:    logger,
	}

	return &App{
		Config: cfg,
		Logger: logger,
		Runner: runner,
	}, nil
}

// Run starts the worker until ctx is cancelled, then waits for graceful drain.
func (a *App) Run(ctx context.Context) error {
	a.Logger.Info("worker starting",
		"interval", a.Config.Interval.String(),
		"shutdown_timeout", a.Config.ShutdownTimeout.String(),
	)

	err := worker.Run(ctx, a.Config.ShutdownTimeout, a.Runner.Run)
	if err != nil {
		return err
	}

	a.Logger.Info("worker stopped")
	return nil
}

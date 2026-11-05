package worker

import (
	"context"
	"log/slog"
	"time"
)

// Processor performs one unit of background work.
// Implement this interface for your own jobs; keep side effects here, not in Runner.
type Processor interface {
	Process(ctx context.Context) error
}

// ExampleProcessor is a starter implementation that logs a heartbeat tick.
// Replace it with real work (poll a queue, sync data, etc.).
type ExampleProcessor struct {
	Logger *slog.Logger
}

func (p ExampleProcessor) Process(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	logger := p.Logger
	if logger == nil {
		logger = slog.Default()
	}
	logger.Info("example processor tick", "at", time.Now().UTC().Format(time.RFC3339))
	return nil
}

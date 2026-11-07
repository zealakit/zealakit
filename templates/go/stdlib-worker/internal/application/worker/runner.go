package worker

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// Runner invokes a Processor on a fixed interval.
// Ticks never overlap: the next interval starts after Process returns.
type Runner struct {
	Processor Processor
	Interval  time.Duration
	Logger    *slog.Logger
}

// Run blocks until ctx is cancelled or a non-cancellation processing error occurs.
// Context cancellation is treated as a normal stop (returns nil).
func (r *Runner) Run(ctx context.Context) error {
	if r.Processor == nil {
		return fmt.Errorf("worker runner: processor is required")
	}
	if r.Interval <= 0 {
		return fmt.Errorf("worker runner: interval must be greater than zero")
	}

	logger := r.Logger
	if logger == nil {
		logger = slog.Default()
	}

	ticker := time.NewTicker(r.Interval)
	defer ticker.Stop()

	logger.Info("worker runner started", "interval", r.Interval.String())

	// Run once immediately so startup does not wait a full interval.
	if err := r.tick(ctx, logger); err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			reason := "canceled"
			if cause := context.Cause(ctx); cause != nil {
				reason = cause.Error()
			}
			logger.Info("worker runner stopping", "reason", reason)
			return nil
		case <-ticker.C:
			if err := r.tick(ctx, logger); err != nil {
				return err
			}
		}
	}
}

func (r *Runner) tick(ctx context.Context, logger *slog.Logger) error {
	if err := ctx.Err(); err != nil {
		return nil
	}

	start := time.Now()
	logger.Debug("processing tick started")
	err := r.Processor.Process(ctx)
	duration := time.Since(start)

	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			logger.Info("processing tick cancelled", "duration", duration.String())
			return nil
		}
		logger.Error("processing tick failed", "duration", duration.String(), "error", err)
		return fmt.Errorf("process tick: %w", err)
	}

	logger.Info("processing tick completed", "duration", duration.String())
	return nil
}

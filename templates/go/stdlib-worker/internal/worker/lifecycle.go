package worker

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// RunFunc is a blocking worker loop that returns when ctx is cancelled or on failure.
type RunFunc func(ctx context.Context) error

// Run supervises a worker loop until parent is cancelled, then waits for the loop
// to finish up to shutdownTimeout. It does not block forever on shutdown.
func Run(parent context.Context, shutdownTimeout time.Duration, run RunFunc) error {
	if run == nil {
		return fmt.Errorf("lifecycle: run function is required")
	}
	if shutdownTimeout <= 0 {
		return fmt.Errorf("lifecycle: shutdown timeout must be greater than zero")
	}

	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- run(ctx)
	}()

	select {
	case err := <-errCh:
		return normalizeStop(err)
	case <-parent.Done():
		cancel()
		timer := time.NewTimer(shutdownTimeout)
		defer timer.Stop()
		select {
		case err := <-errCh:
			return normalizeStop(err)
		case <-timer.C:
			return fmt.Errorf("graceful shutdown timed out after %s", shutdownTimeout)
		}
	}
}

func normalizeStop(err error) error {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return nil
	}
	return err
}

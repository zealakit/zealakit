package worker_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"example.com/zealakit/stdlib-worker/internal/worker"
)

func TestLifecycleNormalCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan struct{})
	go func() {
		<-started
		cancel()
	}()

	err := worker.Run(ctx, time.Second, func(runCtx context.Context) error {
		close(started)
		<-runCtx.Done()
		return runCtx.Err()
	})
	if err != nil {
		t.Fatalf("Run() = %v", err)
	}
}

func TestLifecyclePropagatesFailure(t *testing.T) {
	boom := errors.New("fatal")
	err := worker.Run(context.Background(), time.Second, func(context.Context) error {
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("Run() = %v, want %v", err, boom)
	}
}

func TestLifecycleShutdownTimeout(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan struct{})

	errCh := make(chan error, 1)
	go func() {
		errCh <- worker.Run(ctx, 30*time.Millisecond, func(runCtx context.Context) error {
			close(started)
			<-runCtx.Done()
			time.Sleep(200 * time.Millisecond) // ignore cancel — simulates stuck work
			return nil
		})
	}()

	<-started
	cancel()

	select {
	case err := <-errCh:
		if err == nil || err.Error() == "" {
			t.Fatalf("expected timeout error, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("lifecycle did not return after shutdown timeout")
	}
}

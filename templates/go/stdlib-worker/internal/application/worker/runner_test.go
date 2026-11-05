package worker_test

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"example.com/zealakit/stdlib-worker/internal/application/worker"
)

type countingProcessor struct {
	n        atomic.Int32
	block    chan struct{}
	failOnce atomic.Bool
}

func (p *countingProcessor) Process(ctx context.Context) error {
	p.n.Add(1)
	if p.failOnce.CompareAndSwap(true, false) {
		return errors.New("boom")
	}
	if p.block != nil {
		select {
		case <-p.block:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return ctx.Err()
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestRunnerStopsOnCancel(t *testing.T) {
	p := &countingProcessor{}
	r := &worker.Runner{
		Processor: p,
		Interval:  20 * time.Millisecond,
		Logger:    testLogger(),
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- r.Run(ctx) }()

	deadline := time.Now().Add(time.Second)
	for p.n.Load() < 1 {
		if time.Now().After(deadline) {
			cancel()
			t.Fatal("processor never ran")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run() = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Run did not return after cancel")
	}
}

func TestRunnerPropagatesProcessorError(t *testing.T) {
	p := &countingProcessor{}
	p.failOnce.Store(true)
	r := &worker.Runner{
		Processor: p,
		Interval:  time.Hour,
		Logger:    testLogger(),
	}

	err := r.Run(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestRunnerRejectsInvalidConfig(t *testing.T) {
	r := &worker.Runner{Interval: time.Second, Logger: testLogger()}
	if err := r.Run(context.Background()); err == nil {
		t.Fatal("expected missing processor error")
	}
}

func TestRunnerDoesNotOverlapTicks(t *testing.T) {
	release := make(chan struct{})
	p := &countingProcessor{block: release}
	r := &worker.Runner{
		Processor: p,
		Interval:  10 * time.Millisecond,
		Logger:    testLogger(),
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- r.Run(ctx) }()

	deadline := time.Now().Add(time.Second)
	for p.n.Load() < 1 {
		if time.Now().After(deadline) {
			t.Fatal("first tick never started")
		}
		time.Sleep(5 * time.Millisecond)
	}

	// While the first Process is blocked, ticker may fire but Run waits — still one in-flight.
	time.Sleep(40 * time.Millisecond)
	if got := p.n.Load(); got != 1 {
		t.Fatalf("overlapping ticks: count=%d want 1", got)
	}

	close(release)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Run did not return")
	}
}

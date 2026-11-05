package worker_test

import (
	"context"
	"errors"
	"testing"

	"example.com/zealakit/stdlib-worker/internal/application/worker"
)

func TestExampleProcessorRespectsCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	p := worker.ExampleProcessor{Logger: testLogger()}
	if err := p.Process(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("Process() = %v, want context.Canceled", err)
	}
}

func TestExampleProcessorOK(t *testing.T) {
	p := worker.ExampleProcessor{Logger: testLogger()}
	if err := p.Process(context.Background()); err != nil {
		t.Fatalf("Process() = %v", err)
	}
}

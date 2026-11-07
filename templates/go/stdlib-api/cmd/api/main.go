package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"

	"example.com/zealakit/stdlib-api/internal/bootstrap"
)

func main() {
	app, err := bootstrap.New()
	if err != nil {
		log.Fatalf("bootstrap failed: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		app.Logger.Error("server stopped with error", "error", err)
		os.Exit(1)
	}
}

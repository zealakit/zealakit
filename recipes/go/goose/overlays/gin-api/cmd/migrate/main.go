// Command migrate applies or rolls back SQL migrations with goose.
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate down
//	go run ./cmd/migrate status
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"example.com/zealakit/gin-api/internal/infrastructure/database"
)

func main() {
	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(ctx, db, command); err != nil {
		fmt.Fprintf(os.Stderr, "migrate %s: %v\n", command, err)
		os.Exit(1)
	}
}

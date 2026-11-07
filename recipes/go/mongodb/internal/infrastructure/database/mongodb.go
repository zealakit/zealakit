// Package database provides MongoDB connectivity for Go services.
//
// It wraps the official MongoDB Go Driver v2 with a small connection API.
// Callers own the client lifecycle.
package database

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	defaultConnectTimeout   = 5 * time.Second
	defaultOperationTimeout = 10 * time.Second
)

// Config describes the MongoDB client.
type Config struct {
	URI              string
	Database         string
	ConnectTimeout   time.Duration
	OperationTimeout time.Duration
}

// ConfigFromEnv reads MONGODB_URI, MONGODB_DATABASE and timeout settings from
// the process environment. It does not load .env files.
func ConfigFromEnv() (Config, error) {
	cfg := Config{
		URI:              strings.TrimSpace(os.Getenv("MONGODB_URI")),
		Database:         strings.TrimSpace(os.Getenv("MONGODB_DATABASE")),
		ConnectTimeout:   defaultConnectTimeout,
		OperationTimeout: defaultOperationTimeout,
	}
	if cfg.URI == "" {
		return Config{}, fmt.Errorf("MONGODB_URI is required")
	}
	if cfg.Database == "" {
		return Config{}, fmt.Errorf("MONGODB_DATABASE is required")
	}

	var err error
	if cfg.ConnectTimeout, err = envDuration("MONGODB_CONNECT_TIMEOUT", cfg.ConnectTimeout); err != nil {
		return Config{}, err
	}
	if cfg.OperationTimeout, err = envDuration("MONGODB_OPERATION_TIMEOUT", cfg.OperationTimeout); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// Client wraps the mongo client with the configured operation timeout.
type Client struct {
	*mongo.Client
	operationTimeout time.Duration
}

// Open creates a MongoDB client, verifies connectivity, and returns a client
// whose operation contexts use MONGODB_OPERATION_TIMEOUT. The caller must call
// Close.
func Open(ctx context.Context) (*Client, error) {
	cfg, err := ConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("database config: %w", err)
	}

	client, err := mongo.Connect(
		options.Client().
			ApplyURI(cfg.URI).
			SetConnectTimeout(cfg.ConnectTimeout),
	)
	if err != nil {
		return nil, fmt.Errorf("connect mongodb: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, cfg.ConnectTimeout)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("ping mongodb: %w", err)
	}
	return &Client{Client: client, operationTimeout: cfg.OperationTimeout}, nil
}

// OperationContext derives a timeout context for a database operation.
func (c *Client) OperationContext(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, c.operationTimeout)
}

// Close disconnects the client. Call it once during graceful shutdown.
func (c *Client) Close(ctx context.Context) error {
	return c.Client.Disconnect(ctx)
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration (e.g. 5s)", key)
	}
	return value, nil
}

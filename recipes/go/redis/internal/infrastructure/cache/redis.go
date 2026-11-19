// Package cache provides a Redis client for Go services.
//
// It wraps go-redis behind a small, explicit API. Callers own the client
// lifecycle and must Close it during shutdown.
package cache

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const defaultDialTimeout = 5 * time.Second

// Config describes the Redis connection.
type Config struct {
	URL         string
	DialTimeout time.Duration
}

// ConfigFromEnv reads REDIS_URL and optional settings from the process
// environment. It does not load .env files.
func ConfigFromEnv() (Config, error) {
	cfg := Config{
		URL:         strings.TrimSpace(os.Getenv("REDIS_URL")),
		DialTimeout: defaultDialTimeout,
	}
	if cfg.URL == "" {
		return Config{}, fmt.Errorf("REDIS_URL is required")
	}
	if raw := strings.TrimSpace(os.Getenv("REDIS_DIAL_TIMEOUT")); raw != "" {
		timeout, err := time.ParseDuration(raw)
		if err != nil || timeout <= 0 {
			return Config{}, fmt.Errorf("REDIS_DIAL_TIMEOUT must be a positive duration, got %q", raw)
		}
		cfg.DialTimeout = timeout
	}
	return cfg, nil
}

// Open creates a client and verifies connectivity with a PING.
// On failure the client is closed; on success the caller must close it.
func Open(ctx context.Context) (*redis.Client, error) {
	cfg, err := ConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("redis config: %w", err)
	}

	options, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	options.DialTimeout = cfg.DialTimeout

	client := redis.NewClient(options)
	pingCtx, cancel := context.WithTimeout(ctx, cfg.DialTimeout)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return client, nil
}

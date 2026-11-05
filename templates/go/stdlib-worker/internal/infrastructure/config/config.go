package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds process configuration loaded from the environment.
type Config struct {
	AppName         string
	Environment     string
	LogLevel        string
	LogFormat       string
	Interval        time.Duration
	ShutdownTimeout time.Duration
}

// Load reads configuration from environment variables with sensible defaults.
// It does not load .env files — use your shell or process manager for that.
func Load() (Config, error) {
	cfg := Config{
		AppName:         getenv("APP_NAME", "stdlib-worker"),
		Environment:     getenv("APP_ENV", "development"),
		LogLevel:        getenv("LOG_LEVEL", "info"),
		LogFormat:       getenv("LOG_FORMAT", "text"),
		Interval:        30 * time.Second,
		ShutdownTimeout: 10 * time.Second,
	}

	var err error
	if cfg.Interval, err = getenvDuration("WORKER_INTERVAL", cfg.Interval); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = getenvDuration("WORKER_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout); err != nil {
		return Config{}, err
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// Validate checks configuration invariants.
func (c Config) Validate() error {
	if strings.TrimSpace(c.AppName) == "" {
		return fmt.Errorf("APP_NAME must not be empty")
	}
	if c.Interval <= 0 {
		return fmt.Errorf("WORKER_INTERVAL must be greater than zero")
	}
	if c.ShutdownTimeout <= 0 {
		return fmt.Errorf("WORKER_SHUTDOWN_TIMEOUT must be greater than zero")
	}
	switch strings.ToLower(c.LogLevel) {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("LOG_LEVEL must be one of debug, info, warn, error")
	}
	switch strings.ToLower(c.LogFormat) {
	case "text", "json":
	default:
		return fmt.Errorf("LOG_FORMAT must be text or json")
	}
	return nil
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration (e.g. 30s): %w", key, err)
	}
	return value, nil
}

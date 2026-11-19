package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds process configuration loaded from the environment.
type Config struct {
	AppName      string
	Environment  string
	HTTPHost     string
	HTTPPort     int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
	LogLevel     string
	LogFormat    string
}

// Addr returns host:port for the HTTP listener.
func (c Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.HTTPHost, c.HTTPPort)
}

// Load reads configuration from environment variables with sensible defaults.
// It does not load .env files — use your shell or process manager for that.
func Load() (Config, error) {
	cfg := Config{
		AppName:      getenv("APP_NAME", "stdlib-api"),
		Environment:  getenv("APP_ENV", "development"),
		HTTPHost:     getenv("HTTP_HOST", "0.0.0.0"),
		HTTPPort:     8080,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
		LogLevel:     getenv("LOG_LEVEL", "info"),
		LogFormat:    getenv("LOG_FORMAT", "text"),
	}

	var err error
	if cfg.HTTPPort, err = getenvInt("HTTP_PORT", cfg.HTTPPort); err != nil {
		return Config{}, err
	}
	if cfg.ReadTimeout, err = getenvDuration("HTTP_READ_TIMEOUT", cfg.ReadTimeout); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = getenvDuration("HTTP_WRITE_TIMEOUT", cfg.WriteTimeout); err != nil {
		return Config{}, err
	}
	if cfg.IdleTimeout, err = getenvDuration("HTTP_IDLE_TIMEOUT", cfg.IdleTimeout); err != nil {
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
	if c.HTTPPort < 1 || c.HTTPPort > 65535 {
		return fmt.Errorf("HTTP_PORT must be between 1 and 65535")
	}
	if c.ReadTimeout <= 0 || c.WriteTimeout <= 0 || c.IdleTimeout <= 0 {
		return fmt.Errorf("HTTP timeouts must be greater than zero")
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

func getenvInt(key string, fallback int) (int, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return value, nil
}

func getenvDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration (e.g. 5s): %w", key, err)
	}
	return value, nil
}

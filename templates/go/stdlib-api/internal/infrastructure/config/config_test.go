package config_test

import (
	"testing"

	"example.com/zealakit/stdlib-api/internal/infrastructure/config"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_NAME", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("HTTP_HOST", "")
	t.Setenv("HTTP_PORT", "")
	t.Setenv("HTTP_READ_TIMEOUT", "")
	t.Setenv("HTTP_WRITE_TIMEOUT", "")
	t.Setenv("HTTP_IDLE_TIMEOUT", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("LOG_FORMAT", "")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.AppName != "stdlib-api" {
		t.Fatalf("AppName = %q, want stdlib-api", cfg.AppName)
	}
	if cfg.HTTPPort != 8080 {
		t.Fatalf("HTTPPort = %d, want 8080", cfg.HTTPPort)
	}
	if cfg.Addr() != "0.0.0.0:8080" {
		t.Fatalf("Addr() = %q", cfg.Addr())
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	t.Setenv("HTTP_PORT", "99999")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for invalid HTTP_PORT")
	}
}

func TestLoadRejectsInvalidLogLevel(t *testing.T) {
	t.Setenv("LOG_LEVEL", "verbose")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for invalid LOG_LEVEL")
	}
}

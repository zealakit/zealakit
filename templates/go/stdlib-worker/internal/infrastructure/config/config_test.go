package config_test

import (
	"testing"
	"time"

	"example.com/zealakit/stdlib-worker/internal/infrastructure/config"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_NAME", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("LOG_FORMAT", "")
	t.Setenv("WORKER_INTERVAL", "")
	t.Setenv("WORKER_SHUTDOWN_TIMEOUT", "")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.AppName != "stdlib-worker" {
		t.Fatalf("AppName = %q, want stdlib-worker", cfg.AppName)
	}
	if cfg.Interval != 30*time.Second {
		t.Fatalf("Interval = %s, want 30s", cfg.Interval)
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("ShutdownTimeout = %s, want 10s", cfg.ShutdownTimeout)
	}
}

func TestLoadCustomDurations(t *testing.T) {
	t.Setenv("WORKER_INTERVAL", "5s")
	t.Setenv("WORKER_SHUTDOWN_TIMEOUT", "2s")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Interval != 5*time.Second {
		t.Fatalf("Interval = %s", cfg.Interval)
	}
	if cfg.ShutdownTimeout != 2*time.Second {
		t.Fatalf("ShutdownTimeout = %s", cfg.ShutdownTimeout)
	}
}

func TestLoadRejectsInvalidInterval(t *testing.T) {
	t.Setenv("WORKER_INTERVAL", "0s")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for zero WORKER_INTERVAL")
	}
}

func TestLoadRejectsInvalidDurationSyntax(t *testing.T) {
	t.Setenv("WORKER_INTERVAL", "soon")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for invalid WORKER_INTERVAL")
	}
}

func TestLoadRejectsInvalidLogLevel(t *testing.T) {
	t.Setenv("LOG_LEVEL", "verbose")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error for invalid LOG_LEVEL")
	}
}

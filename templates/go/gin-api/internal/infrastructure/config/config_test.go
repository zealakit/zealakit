package config_test

import (
	"testing"
	"time"

	"example.com/zealakit/gin-api/internal/infrastructure/config"
)

func TestLoadDefaults(t *testing.T) {
	clearEnv(t)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.AppName != "gin-api" {
		t.Fatalf("AppName = %q", cfg.AppName)
	}
	if cfg.Port != 8080 {
		t.Fatalf("Port = %d", cfg.Port)
	}
	if cfg.Addr() != "0.0.0.0:8080" {
		t.Fatalf("Addr() = %q", cfg.Addr())
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("ShutdownTimeout = %s", cfg.ShutdownTimeout)
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	clearEnv(t)
	t.Setenv("APP_PORT", "99999")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error")
	}
}

func TestLoadRejectsInvalidDuration(t *testing.T) {
	clearEnv(t)
	t.Setenv("SERVER_READ_TIMEOUT", "soon")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected error")
	}
}

func clearEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"APP_NAME", "APP_ENV", "APP_HOST", "APP_PORT",
		"LOG_LEVEL", "LOG_FORMAT",
		"SERVER_READ_TIMEOUT", "SERVER_WRITE_TIMEOUT", "SERVER_IDLE_TIMEOUT", "SERVER_SHUTDOWN_TIMEOUT",
	} {
		t.Setenv(key, "")
	}
}

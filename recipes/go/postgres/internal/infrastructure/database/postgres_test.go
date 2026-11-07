package database

import (
	"testing"
	"time"
)

func TestConfigFromEnvRequiresURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error when DATABASE_URL is empty")
	}
}

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/app")
	for _, key := range []string{
		"DB_MAX_OPEN_CONNS",
		"DB_MAX_IDLE_CONNS",
		"DB_CONN_MAX_LIFETIME",
		"DB_CONNECT_TIMEOUT",
	} {
		t.Setenv(key, "")
	}

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("ConfigFromEnv() error = %v", err)
	}
	if cfg.MaxOpenConns != defaultMaxOpenConns {
		t.Fatalf("MaxOpenConns = %d, want %d", cfg.MaxOpenConns, defaultMaxOpenConns)
	}
	if cfg.MaxIdleConns != defaultMaxIdleConns {
		t.Fatalf("MaxIdleConns = %d, want %d", cfg.MaxIdleConns, defaultMaxIdleConns)
	}
	if cfg.ConnMaxLifetime != defaultConnMaxLifetime {
		t.Fatalf("ConnMaxLifetime = %v, want %v", cfg.ConnMaxLifetime, defaultConnMaxLifetime)
	}
	if cfg.ConnectTimeout != defaultConnectTimeout {
		t.Fatalf("ConnectTimeout = %v, want %v", cfg.ConnectTimeout, defaultConnectTimeout)
	}
}

func TestConfigFromEnvOverrides(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/app")
	t.Setenv("DB_MAX_OPEN_CONNS", "20")
	t.Setenv("DB_MAX_IDLE_CONNS", "4")
	t.Setenv("DB_CONN_MAX_LIFETIME", "10m")
	t.Setenv("DB_CONNECT_TIMEOUT", "2s")

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("ConfigFromEnv() error = %v", err)
	}
	if cfg.MaxOpenConns != 20 || cfg.MaxIdleConns != 4 {
		t.Fatalf("unexpected pool sizes: open=%d idle=%d", cfg.MaxOpenConns, cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime != 10*time.Minute || cfg.ConnectTimeout != 2*time.Second {
		t.Fatalf("unexpected durations: lifetime=%v timeout=%v", cfg.ConnMaxLifetime, cfg.ConnectTimeout)
	}
}

func TestConfigFromEnvRejectsInvalidPool(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/app")
	t.Setenv("DB_MAX_OPEN_CONNS", "2")
	t.Setenv("DB_MAX_IDLE_CONNS", "3")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error when idle connections exceed open connections")
	}
}

func TestConfigFromEnvRejectsInvalidDuration(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/app")
	t.Setenv("DB_CONNECT_TIMEOUT", "not-a-duration")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error for an invalid duration")
	}
}

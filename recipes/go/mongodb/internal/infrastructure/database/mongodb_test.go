package database

import (
	"context"
	"testing"
	"time"
)

func TestConfigFromEnvRequiresURI(t *testing.T) {
	t.Setenv("MONGODB_URI", "")
	t.Setenv("MONGODB_DATABASE", "app")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error when MONGODB_URI is empty")
	}
}

func TestConfigFromEnvRequiresDatabase(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("MONGODB_DATABASE", "")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error when MONGODB_DATABASE is empty")
	}
}

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("MONGODB_DATABASE", "app")
	t.Setenv("MONGODB_CONNECT_TIMEOUT", "")
	t.Setenv("MONGODB_OPERATION_TIMEOUT", "")

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("ConfigFromEnv() error = %v", err)
	}
	if cfg.ConnectTimeout != defaultConnectTimeout {
		t.Fatalf("ConnectTimeout = %v, want %v", cfg.ConnectTimeout, defaultConnectTimeout)
	}
	if cfg.OperationTimeout != defaultOperationTimeout {
		t.Fatalf("OperationTimeout = %v, want %v", cfg.OperationTimeout, defaultOperationTimeout)
	}
}

func TestConfigFromEnvOverrides(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("MONGODB_DATABASE", "app")
	t.Setenv("MONGODB_CONNECT_TIMEOUT", "2s")
	t.Setenv("MONGODB_OPERATION_TIMEOUT", "4s")

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("ConfigFromEnv() error = %v", err)
	}
	if cfg.ConnectTimeout != 2*time.Second || cfg.OperationTimeout != 4*time.Second {
		t.Fatalf("unexpected timeouts: connect=%v operation=%v", cfg.ConnectTimeout, cfg.OperationTimeout)
	}
}

func TestOperationContextUsesConfiguredTimeout(t *testing.T) {
	client := &Client{operationTimeout: time.Second}
	ctx, cancel := client.OperationContext(context.Background())
	defer cancel()

	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("expected a deadline")
	}
	remaining := time.Until(deadline)
	if remaining <= 0 || remaining > time.Second {
		t.Fatalf("unexpected operation deadline: %v", remaining)
	}
}

func TestConfigFromEnvRejectsInvalidDuration(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://localhost:27017")
	t.Setenv("MONGODB_DATABASE", "app")
	t.Setenv("MONGODB_CONNECT_TIMEOUT", "not-a-duration")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error for an invalid duration")
	}
}

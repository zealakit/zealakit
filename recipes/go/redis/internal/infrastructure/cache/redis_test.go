package cache

import (
	"testing"
	"time"
)

func TestConfigFromEnv(t *testing.T) {
	t.Setenv("REDIS_URL", "")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error when REDIS_URL is empty")
	}

	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.DialTimeout != 5*time.Second {
		t.Fatalf("default dial timeout = %v", cfg.DialTimeout)
	}

	t.Setenv("REDIS_DIAL_TIMEOUT", "2s")
	cfg, err = ConfigFromEnv()
	if err != nil || cfg.DialTimeout != 2*time.Second {
		t.Fatalf("dial timeout = %v, err = %v", cfg.DialTimeout, err)
	}

	t.Setenv("REDIS_DIAL_TIMEOUT", "nope")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected an error for an invalid timeout")
	}
}

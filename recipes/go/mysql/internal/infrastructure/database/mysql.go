// Package database provides MySQL connectivity for Go services.
//
// It uses database/sql with the go-sql-driver/mysql driver and keeps the
// driver isolated behind a small, explicit API. Callers own the *sql.DB
// lifecycle.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

const (
	defaultMaxOpenConns    = 10
	defaultMaxIdleConns    = 5
	defaultConnMaxLifetime = 30 * time.Minute
	defaultConnectTimeout  = 5 * time.Second
)

// Config describes the MySQL connection pool.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnectTimeout  time.Duration
}

// ConfigFromEnv reads DATABASE_URL and optional pool settings from the process
// environment. It does not load .env files.
func ConfigFromEnv() (Config, error) {
	cfg := Config{
		DSN:             strings.TrimSpace(os.Getenv("DATABASE_URL")),
		MaxOpenConns:    defaultMaxOpenConns,
		MaxIdleConns:    defaultMaxIdleConns,
		ConnMaxLifetime: defaultConnMaxLifetime,
		ConnectTimeout:  defaultConnectTimeout,
	}
	if cfg.DSN == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	var err error
	if cfg.MaxOpenConns, err = envPositiveInt("DB_MAX_OPEN_CONNS", cfg.MaxOpenConns); err != nil {
		return Config{}, err
	}
	if cfg.MaxIdleConns, err = envPositiveInt("DB_MAX_IDLE_CONNS", cfg.MaxIdleConns); err != nil {
		return Config{}, err
	}
	if cfg.ConnMaxLifetime, err = envDuration("DB_CONN_MAX_LIFETIME", cfg.ConnMaxLifetime); err != nil {
		return Config{}, err
	}
	if cfg.ConnectTimeout, err = envDuration("DB_CONNECT_TIMEOUT", cfg.ConnectTimeout); err != nil {
		return Config{}, err
	}
	if cfg.MaxIdleConns > cfg.MaxOpenConns {
		return Config{}, fmt.Errorf("DB_MAX_IDLE_CONNS must not exceed DB_MAX_OPEN_CONNS")
	}
	return cfg, nil
}

// Open creates a MySQL pool, applies pool limits, and verifies connectivity.
// On failure the pool is closed; on success the caller must close it.
func Open(ctx context.Context) (*sql.DB, error) {
	cfg, err := ConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("database config: %w", err)
	}

	db, err := sql.Open("mysql", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	pingCtx, cancel := context.WithTimeout(ctx, cfg.ConnectTimeout)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}
	return db, nil
}

func envPositiveInt(key string, fallback int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	return value, nil
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

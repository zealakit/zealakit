package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"example.com/zealakit/stdlib-api/internal/infrastructure/config"
	"example.com/zealakit/stdlib-api/internal/presentation/http/middleware"
)

// Server wraps http.Server with application middleware.
type Server struct {
	httpServer *http.Server
	logger     *slog.Logger
}

// NewServer builds an HTTP server from config, logger, and handler.
func NewServer(cfg config.Config, logger *slog.Logger, handler http.Handler) *Server {
	var h http.Handler = handler
	h = middleware.Logging(logger)(h)
	h = middleware.Recovery(logger)(h)
	h = middleware.RequestID(h)

	return &Server{
		logger: logger,
		httpServer: &http.Server{
			Addr:         cfg.Addr(),
			Handler:      h,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
		},
	}
}

// Start listens until the context is cancelled, then shuts down gracefully.
func (s *Server) Start(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		s.logger.Info("http server listening", "addr", s.httpServer.Addr)
		err := s.httpServer.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		s.logger.Info("shutting down http server")
		if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("http shutdown: %w", err)
		}
		return <-errCh
	case err := <-errCh:
		return err
	}
}

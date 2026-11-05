package httpapi

import (
	"net/http"

	httpfeaturea "example.com/zealakit/stdlib-api/internal/presentation/http/api/v1/featurea"
	"example.com/zealakit/stdlib-api/internal/presentation/http/handler"
)

// Dependencies required to build the HTTP router.
type RouterDeps struct {
	FeatureA *httpfeaturea.Handler
}

// NewRouter registers HTTP routes on a ServeMux.
func NewRouter(deps RouterDeps) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.Health)
	mux.HandleFunc("GET /api/v1/hello", handler.Hello)

	if deps.FeatureA != nil {
		mux.HandleFunc("POST /api/v1/feature-a/items", deps.FeatureA.CreateItem)
	}

	return mux
}

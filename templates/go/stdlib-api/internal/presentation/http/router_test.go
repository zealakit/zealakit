package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	app "example.com/zealakit/stdlib-api/internal/application/featurea"
	persistence "example.com/zealakit/stdlib-api/internal/infrastructure/persistence/featurea"
	httpapi "example.com/zealakit/stdlib-api/internal/presentation/http"
	httpfeaturea "example.com/zealakit/stdlib-api/internal/presentation/http/api/v1/featurea"
)

func testRouter() *http.ServeMux {
	uc := app.NewCreateItem(persistence.NewMemoryItemRepository())
	return httpapi.NewRouter(httpapi.RouterDeps{
		FeatureA: httpfeaturea.NewHandler(uc),
	})
}

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	testRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("body = %#v", body)
	}
}

func TestHelloEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/hello", nil)
	rec := httptest.NewRecorder()
	testRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["message"] != "Hello from Zealakit Go API" {
		t.Fatalf("body = %#v", body)
	}
}

func TestCreateItemEndpoint(t *testing.T) {
	payload, _ := json.Marshal(map[string]string{"name": "Widget"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/feature-a/items", bytes.NewReader(payload))
	rec := httptest.NewRecorder()
	testRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["name"] != "Widget" || body["id"] == "" {
		t.Fatalf("body = %#v", body)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/health", nil)
	rec := httptest.NewRecorder()
	testRouter().ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed && rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 405 or 404", rec.Code)
	}
}

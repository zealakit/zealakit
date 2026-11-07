package featurea_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	app "example.com/zealakit/stdlib-api/internal/application/featurea"
	persistence "example.com/zealakit/stdlib-api/internal/infrastructure/persistence/featurea"
	httpfeaturea "example.com/zealakit/stdlib-api/internal/presentation/http/api/v1/featurea"
)

func TestCreateItemHandler(t *testing.T) {
	uc := app.NewCreateItem(persistence.NewMemoryItemRepository())
	h := httpfeaturea.NewHandler(uc)

	body, _ := json.Marshal(map[string]string{"name": "Widget"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/feature-a/items", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.CreateItem(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["name"] != "Widget" || got["id"] == "" {
		t.Fatalf("body = %#v", got)
	}
}

func TestCreateItemHandlerValidation(t *testing.T) {
	uc := app.NewCreateItem(persistence.NewMemoryItemRepository())
	h := httpfeaturea.NewHandler(uc)

	body, _ := json.Marshal(map[string]string{"name": "  "})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/feature-a/items", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.CreateItem(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
}

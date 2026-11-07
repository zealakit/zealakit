package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"example.com/zealakit/stdlib-api/internal/presentation/http/respond"
)

func TestJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	respond.JSON(rec, http.StatusCreated, map[string]string{"ok": "yes"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Fatalf("content-type = %q", ct)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["ok"] != "yes" {
		t.Fatalf("body = %#v", body)
	}
}

func TestErrorJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	respond.ErrorJSON(rec, http.StatusBadRequest, "bad input")

	var body respond.ErrorBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error != "bad input" {
		t.Fatalf("error = %q", body.Error)
	}
}

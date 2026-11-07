package handler

import (
	"net/http"

	"example.com/zealakit/stdlib-api/internal/presentation/http/respond"
)

// Hello is a starter sample endpoint (not a business domain).
func Hello(w http.ResponseWriter, _ *http.Request) {
	respond.JSON(w, http.StatusOK, map[string]string{
		"message": "Hello from Zealakit Go API",
	})
}

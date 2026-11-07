package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorBody is the standard error payload shape for this API.
type ErrorBody struct {
	Error string `json:"error"`
}

// JSON writes a successful JSON payload with the given status.
func JSON(c *gin.Context, status int, payload any) {
	c.JSON(status, payload)
}

// Error writes a JSON error payload. Internal details stay in logs, not here.
func Error(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, ErrorBody{Error: message})
}

// BadRequest is a convenience for 400 responses.
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// Internal is a convenience for 500 responses (generic client message).
func Internal(c *gin.Context) {
	Error(c, http.StatusInternalServerError, "internal server error")
}

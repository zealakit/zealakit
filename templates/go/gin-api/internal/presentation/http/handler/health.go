package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"example.com/zealakit/gin-api/internal/presentation/http/response"
)

// Health is a liveness probe for orchestrators and load balancers.
func Health(c *gin.Context) {
	response.JSON(c, http.StatusOK, gin.H{"status": "ok"})
}

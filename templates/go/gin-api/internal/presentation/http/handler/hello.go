package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"example.com/zealakit/gin-api/internal/presentation/http/response"
)

type helloQuery struct {
	Name string `form:"name" binding:"omitempty,max=64"`
}

// Hello is a sample versioned endpoint.
// Optional query: ?name=Ada → personalized message (demonstrates Gin binding).
func Hello(c *gin.Context) {
	var query helloQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "invalid query parameters")
		return
	}

	message := "Hello from Zealakit Gin API"
	if query.Name != "" {
		message = "Hello, " + query.Name
	}
	response.JSON(c, http.StatusOK, gin.H{"message": message})
}

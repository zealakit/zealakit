package featurea

import (
	"encoding/json"
	"errors"
	"net/http"

	app "example.com/zealakit/stdlib-api/internal/application/featurea"
	domain "example.com/zealakit/stdlib-api/internal/domain/featurea"
	"example.com/zealakit/stdlib-api/internal/presentation/http/respond"
)

// Handler exposes HTTP endpoints for feature A.
type Handler struct {
	createItem *app.CreateItem
}

func NewHandler(createItem *app.CreateItem) *Handler {
	return &Handler{createItem: createItem}
}

type createItemRequest struct {
	Name string `json:"name"`
}

type itemResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CreateItem handles POST /api/v1/feature-a/items.
func (h *Handler) CreateItem(w http.ResponseWriter, r *http.Request) {
	var body createItemRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		respond.ErrorJSON(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	result, err := h.createItem.Execute(r.Context(), app.CreateItemInput{Name: body.Name})
	if err != nil {
		if errors.Is(err, domain.ErrInvalidName) {
			respond.ErrorJSON(w, http.StatusBadRequest, err.Error())
			return
		}
		respond.ErrorJSON(w, http.StatusInternalServerError, "failed to create item")
		return
	}

	respond.JSON(w, http.StatusCreated, itemResponse{
		ID:   result.ID,
		Name: result.Name,
	})
}

package featurea

import (
	"context"
	"fmt"

	domain "example.com/zealakit/stdlib-api/internal/domain/featurea"
)

// CreateItemInput is the application command for creating an Item.
type CreateItemInput struct {
	Name string
}

// CreateItemResult is the application DTO returned to presentation.
type CreateItemResult struct {
	ID   string
	Name string
}

// CreateItem is the create-item use case.
type CreateItem struct {
	repo domain.ItemRepository
}

func NewCreateItem(repo domain.ItemRepository) *CreateItem {
	return &CreateItem{repo: repo}
}

func (uc *CreateItem) Execute(ctx context.Context, in CreateItemInput) (CreateItemResult, error) {
	item, err := domain.CreateItem(in.Name)
	if err != nil {
		return CreateItemResult{}, err
	}

	if err := uc.repo.Save(ctx, item); err != nil {
		return CreateItemResult{}, fmt.Errorf("save item: %w", err)
	}

	// Domain events (item.PullDomainEvents()) can be published via a bus port later.
	return CreateItemResult{
		ID:   item.ID().String(),
		Name: item.Name(),
	}, nil
}

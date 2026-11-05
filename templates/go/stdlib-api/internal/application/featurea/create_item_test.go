package featurea_test

import (
	"context"
	"sync"
	"testing"

	app "example.com/zealakit/stdlib-api/internal/application/featurea"
	domain "example.com/zealakit/stdlib-api/internal/domain/featurea"
)

type memoryRepo struct {
	mu    sync.Mutex
	store map[domain.ItemID]*domain.Item
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{store: make(map[domain.ItemID]*domain.Item)}
}

func (r *memoryRepo) Save(_ context.Context, item *domain.Item) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.store[item.ID()] = item
	return nil
}

func (r *memoryRepo) FindByID(_ context.Context, id domain.ItemID) (*domain.Item, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.store[id], nil
}

func TestCreateItemUseCase(t *testing.T) {
	uc := app.NewCreateItem(newMemoryRepo())
	result, err := uc.Execute(context.Background(), app.CreateItemInput{Name: "Widget"})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Name != "Widget" || result.ID == "" {
		t.Fatalf("result = %#v", result)
	}
}

func TestCreateItemUseCaseValidation(t *testing.T) {
	uc := app.NewCreateItem(newMemoryRepo())
	if _, err := uc.Execute(context.Background(), app.CreateItemInput{Name: " "}); err == nil {
		t.Fatal("expected validation error")
	}
}

package featurea

import (
	"context"
	"sync"

	domain "example.com/zealakit/stdlib-api/internal/domain/featurea"
)

// MemoryItemRepository is an in-memory ItemRepository adapter.
// Swap for SQL/driver-backed storage without changing domain or application.
type MemoryItemRepository struct {
	mu    sync.RWMutex
	store map[domain.ItemID]storedItem
}

type storedItem struct {
	ID   domain.ItemID
	Name string
}

func NewMemoryItemRepository() *MemoryItemRepository {
	return &MemoryItemRepository{store: make(map[domain.ItemID]storedItem)}
}

func (r *MemoryItemRepository) Save(_ context.Context, item *domain.Item) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.store[item.ID()] = storedItem{ID: item.ID(), Name: item.Name()}
	return nil
}

func (r *MemoryItemRepository) FindByID(_ context.Context, id domain.ItemID) (*domain.Item, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	row, ok := r.store[id]
	if !ok {
		return nil, nil
	}
	return domain.ReconstituteItem(row.ID, row.Name), nil
}

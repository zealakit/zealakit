package featurea

import "context"

// ItemRepository is the persistence port for Item.
// Implementations live in infrastructure; the domain never imports them.
type ItemRepository interface {
	Save(ctx context.Context, item *Item) error
	FindByID(ctx context.Context, id ItemID) (*Item, error)
}

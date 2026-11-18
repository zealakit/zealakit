package featurea

import (
	"errors"
	"strings"
)

// ErrInvalidName is returned when an Item name fails validation.
var ErrInvalidName = errors.New("item name cannot be empty")

// ItemCreated is raised when a new Item is created in the domain.
type ItemCreated struct {
	ItemID ItemID
	Name   string
}

// Item is the sample aggregate for feature A.
type Item struct {
	id     ItemID
	name   string
	events []ItemCreated
}

// CreateItem enforces invariants and records an ItemCreated event.
func CreateItem(name string) (*Item, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, ErrInvalidName
	}

	id, err := NewItemID()
	if err != nil {
		return nil, err
	}

	item := &Item{id: id, name: trimmed}
	item.events = append(item.events, ItemCreated{ItemID: id, Name: trimmed})
	return item, nil
}

// ReconstituteItem rebuilds an Item from persistence without re-firing create events.
func ReconstituteItem(id ItemID, name string) *Item {
	return &Item{id: id, name: name}
}

func (i *Item) ID() ItemID   { return i.id }
func (i *Item) Name() string { return i.name }

// PullDomainEvents returns and clears recorded domain events.
func (i *Item) PullDomainEvents() []ItemCreated {
	events := i.events
	i.events = nil
	return events
}

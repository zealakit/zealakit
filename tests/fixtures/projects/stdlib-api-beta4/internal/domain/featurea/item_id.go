package featurea

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// ItemID is the identity of an Item.
type ItemID string

// NewItemID generates a random opaque identifier.
func NewItemID() (ItemID, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate item id: %w", err)
	}
	return ItemID(hex.EncodeToString(b[:])), nil
}

// ParseItemID validates a non-empty identity string.
func ParseItemID(raw string) (ItemID, error) {
	if raw == "" {
		return "", fmt.Errorf("item id cannot be empty")
	}
	return ItemID(raw), nil
}

func (id ItemID) String() string {
	return string(id)
}

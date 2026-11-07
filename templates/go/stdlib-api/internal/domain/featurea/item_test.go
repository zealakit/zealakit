package featurea_test

import (
	"testing"

	"example.com/zealakit/stdlib-api/internal/domain/featurea"
)

func TestCreateItem(t *testing.T) {
	item, err := featurea.CreateItem("  Widget  ")
	if err != nil {
		t.Fatalf("CreateItem: %v", err)
	}
	if item.Name() != "Widget" {
		t.Fatalf("Name = %q", item.Name())
	}
	if item.ID() == "" {
		t.Fatal("expected non-empty id")
	}
	events := item.PullDomainEvents()
	if len(events) != 1 || events[0].Name != "Widget" {
		t.Fatalf("events = %#v", events)
	}
	if len(item.PullDomainEvents()) != 0 {
		t.Fatal("events should be cleared after pull")
	}
}

func TestCreateItemRejectsEmptyName(t *testing.T) {
	if _, err := featurea.CreateItem("   "); err == nil {
		t.Fatal("expected error")
	}
}

func TestReconstituteItemDoesNotRaiseEvents(t *testing.T) {
	id, err := featurea.ParseItemID("abc")
	if err != nil {
		t.Fatal(err)
	}
	item := featurea.ReconstituteItem(id, "Widget")
	if len(item.PullDomainEvents()) != 0 {
		t.Fatal("reconstitute must not raise create events")
	}
}

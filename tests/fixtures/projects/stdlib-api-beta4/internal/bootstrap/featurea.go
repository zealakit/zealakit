package bootstrap

import (
	app "example.com/stdlib-api-beta4/internal/application/featurea"
	persistence "example.com/stdlib-api-beta4/internal/infrastructure/persistence/featurea"
	httpfeaturea "example.com/stdlib-api-beta4/internal/presentation/http/api/v1/featurea"
)

// FeatureA holds the wired dependencies for the sample feature.
type FeatureA struct {
	Handler *httpfeaturea.Handler
}

func newFeatureA() FeatureA {
	repo := persistence.NewMemoryItemRepository()
	createItem := app.NewCreateItem(repo)
	return FeatureA{
		Handler: httpfeaturea.NewHandler(createItem),
	}
}

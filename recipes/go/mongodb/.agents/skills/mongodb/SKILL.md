---
name: mongodb
description: >-
  MongoDB connectivity for this Go service using the official MongoDB Go Driver
  v2. Use when wiring the client, adding collections/documents, or handling
  shutdown. No ODM.
---

# MongoDB (official Go Driver v2)

The recipe provides `internal/infrastructure/database`:

```go
client, err := database.Open(ctx)
if err != nil {
	return nil, fmt.Errorf("open database: %w", err)
}
defer client.Close(context.Background())
```

`Client` embeds `*mongo.Client`; the configured operation timeout is available
through `client.OperationContext(parent)`.

## Configuration

`database.ConfigFromEnv()` reads:

| Variable | Required | Default |
| --- | --- | --- |
| `MONGODB_URI` | yes | — |
| `MONGODB_DATABASE` | yes | — |
| `MONGODB_CONNECT_TIMEOUT` | no | `5s` |
| `MONGODB_OPERATION_TIMEOUT` | no | `10s` |

`Open` connects and pings the deployment before returning. If ping fails, the
client is disconnected.

## Example

```go
func CreateItem(ctx context.Context, client *database.Client, name string) error {
	opCtx, cancel := client.OperationContext(ctx)
	defer cancel()

	collection := client.Database("app").Collection("items")
	_, err := collection.InsertOne(opCtx, bson.M{"name": name})
	return err
}
```

Read `MONGODB_DATABASE` from configuration; the example uses `app` for brevity.

## Lifecycle

- Create the client once in `internal/bootstrap`.
- Pass the client/collection to infrastructure adapters; do not use a package-level global.
- Disconnect during shutdown, after the HTTP server/worker stops.

## Queries

- Always pass a `context.Context` and check errors.
- Use `bson.M`/typed structs for documents; no ODM.
- Do not add a generic repository abstraction for a single use case.

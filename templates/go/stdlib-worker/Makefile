.PHONY: run test vet fmt build

run:
	go run ./cmd/worker

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

build:
	go build -o bin/worker ./cmd/worker

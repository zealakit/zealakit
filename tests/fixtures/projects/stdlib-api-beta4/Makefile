.PHONY: run test vet fmt build

run:
	go run ./cmd/api

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

build:
	go build -o bin/api ./cmd/api

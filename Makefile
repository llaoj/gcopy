.PHONY: all \
        vet fmt version test \
        push-container release clean gomod \
        frontend-build

DOCKER_PLATFORMS=linux/amd64,linux/arm64
VERSION=$(shell cat version.txt)
TAG?=$(VERSION)
REGISTRY?=docker.io/llaoj
PKG:=github.com/llaoj/gcopy
GCOPY_IMAGE_REPO:=$(REGISTRY)/gcopy
CGO_ENABLED:=0
OS_ARCHS ?= linux/amd64 linux/arm64 darwin/amd64 darwin/arm64
STATIC_DIR=internal/static/dist

# Frontend build output directory for Go embed
STATIC_DIR=internal/static/dist

version:
	@echo $(VERSION)
	cd frontend && npm version $(VERSION) --allow-same-version && npm run prettier && cd ..

frontend-build:
	rm -rf $(STATIC_DIR)
	cd frontend && npm ci && npm run build
	cp -r frontend/out $(STATIC_DIR)

vet:
	go vet ./...

fmt:
	gofmt -s -w -l $(shell find . -type f -name '*.go' -not -path './vendor/*')
	cd frontend && npm run prettier && cd ..

test: vet fmt
	go test -timeout=1m -v -race -short ./...

bin/gcopy: frontend-build
	@for os_arch in $(OS_ARCHS); do \
		os=$${os_arch%%/*}; \
		arch=$${os_arch##*/}; \
		echo "Building bin/gcopy-$(VERSION)-$$os-$$arch ..."; \
		CGO_ENABLED=$(CGO_ENABLED) GOOS=$$os GOARCH=$$arch go build \
			-o bin/gcopy-$(VERSION)-$$os-$$arch \
			-ldflags '-X $(PKG)/pkg/version.version=$(VERSION)' \
			./cmd; \
	done

push-container: clean
	docker buildx create --platform $(DOCKER_PLATFORMS) --use
	docker buildx build --push --platform $(DOCKER_PLATFORMS) -t $(GCOPY_IMAGE_REPO):$(TAG) -t $(GCOPY_IMAGE_REPO):latest -f build/Dockerfile .

clean:
	rm -rf bin/
	rm -rf $(STATIC_DIR)
	rm -f coverage.out

gomod:
	go mod tidy
	go mod vendor
	go mod verify

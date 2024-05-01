.PHONY: all \
        vet fmt version test \
        push-container release clean gomod

# The set of OS_ARCH that GCopy can build against.
DOCKER_PLATFORMS=linux/amd64,linux/arm64

# VERSION is the version of the binary.
VERSION=$(shell cat version.txt)

# TAG is the tag of the container image, default to binary version.
TAG?=$(VERSION)

# REGISTRY is the container registry to push into.
REGISTRY?=docker.io/llaoj

# PKG is the package name of gcopy repo.
PKG:=github.com/llaoj/gcopy

# The image repo of the gcopy container image.
GCOPY_IMAGE_REPO:=$(REGISTRY)/gcopy
# The image repo of the gcopy web client container image.
GCOPY_FRONTEND_IMAGE_REPO:=$(REGISTRY)/gcopy-frontend

# Disable cgo by default to make the binary statically linked.
CGO_ENABLED:=0

# Set default Go architecture to AMD64.
GOARCH ?= amd64

version:
	@echo $(VERSION)
	cd frontend && npm version $(VERSION) --allow-same-version && npm run prettier && cd ..

vet:
	go list -tags "" ./... | grep -v "./vendor/*" | xargs go vet -tags ""

fmt:
	find . -type f -name "*.go" | grep -v "./vendor/*" | xargs gofmt -s -w -l

test: vet fmt
	go test -timeout=1m -v -race -short ./...

./bin/gcopy:
	CGO_ENABLED=$(CGO_ENABLED) GOOS=linux GOARCH=$(GOARCH) go build \
		-o bin/gcopy \
		-ldflags '-X $(PKG)/pkg/version.version=$(VERSION)' \
		./cmd

push-container: clean
	docker buildx create --platform $(DOCKER_PLATFORMS) --use
	docker buildx build --push --platform $(DOCKER_PLATFORMS) -t $(GCOPY_IMAGE_REPO):$(TAG) -t $(GCOPY_IMAGE_REPO):latest -f build/gcopy/Dockerfile .
	docker buildx build --push --platform $(DOCKER_PLATFORMS) -t $(GCOPY_FRONTEND_IMAGE_REPO):$(TAG) -t $(GCOPY_FRONTEND_IMAGE_REPO):latest -f build/frontend/Dockerfile .

clean:
	rm -rf bin/
	rm -f coverage.out

gomod:
	go mod tidy
	go mod vendor
	go mod verify

.PHONY: all \
        vet fmt version test \
        push-container release clean gomod

# PLATFORMS is the set of OS_ARCH that NPD can build against.
LINUX_PLATFORMS=linux_amd64
DOCKER_PLATFORMS=linux/amd64
PLATFORMS=$(LINUX_PLATFORMS) windows_amd64

# VERSION is the version of the binary.
VERSION?=$(shell if [ -d .git ]; then echo `git describe --abbrev=0`; else echo "UNKNOWN"; fi)

# TAG is the tag of the container image, default to binary version.
TAG?=$(VERSION)

# REGISTRY is the container registry to push into.
REGISTRY?=registry.cn-beijing.aliyuncs.com/llaoj

# PKG is the package name of gcopy repo.
PKG:=github.com/llaoj/gcopy

# GCOPY_IMAGE is the image name of the gcopy container image.
GCOPY_IMAGE:=$(REGISTRY)/gcopy:$(TAG)
# GCOPY_FRONTEND_IMAGE is the image name of the gcopy web client container image.
GCOPY_FRONTEND_IMAGE:=$(REGISTRY)/gcopy-frontend:$(TAG)

# Disable cgo by default to make the binary statically linked.
CGO_ENABLED:=0


version:
	@echo $(VERSION)

vet:
	go list -tags "" ./... | grep -v "./vendor/*" | xargs go vet -tags ""

fmt:
	find . -type f -name "*.go" | grep -v "./vendor/*" | xargs gofmt -s -w -l

test: vet fmt
	go test -timeout=1m -v -race -short ./...

output/linux_amd64/bin/%:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) \
	  CC=x86_64-linux-gnu-gcc go build \
		-o $@ \
		-ldflags '-X $(PKG)/pkg/version.version=$(VERSION)' \
		./cmd
	touch $@

output/windows_amd64/bin/%.exe:
	GOOS=windows GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) go build \
		-o $@ \
		-ldflags '-X $(PKG)/pkg/version.version=$(VERSION)' \
		./cmd
	touch $@

output/darwin_amd64/bin/%:
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) go build \
		-o $@ \
		-ldflags '-X $(PKG)/pkg/version.version=$(VERSION)' \
		./cmd
	touch $@

push-container: clean
	docker buildx create --platform $(DOCKER_PLATFORMS) --use
	docker buildx build --push --platform $(DOCKER_PLATFORMS) -t $(GCOPY_IMAGE) -f build/gcopy/Dockerfile
	docker buildx build --push --platform $(DOCKER_PLATFORMS) -t $(GCOPY_FRONTEND_IMAGE) -f build/frontend/Dockerfile

clean:
	rm -rf output/
	rm -f coverage.out

gomod:
	go mod tidy
	go mod vendor
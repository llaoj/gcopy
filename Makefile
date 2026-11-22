.PHONY: all \
        vet fmt version release test \
        push-container clean gomod \
        frontend-build package-release \
        docs-dev docs-build

DOCKER_PLATFORMS=linux/amd64,linux/arm64
VERSION?=$(shell cat version.txt)
TAG?=$(VERSION)
REGISTRY?=docker.io/llaoj
PKG:=github.com/llaoj/gcopy
GCOPY_IMAGE_REPO:=$(REGISTRY)/gcopy
CGO_ENABLED:=0
OS_ARCHS ?= linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64

# Frontend build output directory for Go embed
STATIC_DIR=internal/static/dist

version:
	@echo $(VERSION)
	cd frontend && npm version $(VERSION) --allow-same-version && npm run prettier && cd ..

frontend-build:
	rm -rf $(STATIC_DIR)
	cd frontend && npm ci && npm run build
	cp -r frontend/out $(STATIC_DIR)
	touch $(STATIC_DIR)/.gitkeep

docs-dev:
	cd docs && npm run docs:dev

docs-build:
	cd docs && npm run docs:build

vet:
	go vet ./...

fmt:
	gofmt -s -w -l $(shell find . -type f -name '*.go' -not -path './vendor/*')
	cd frontend && npm run prettier && cd ..

test: vet fmt
	go test -timeout=1m -v -race -short ./...

bin/gcopy: frontend-build
	@mkdir -p bin
	@for os_arch in $(OS_ARCHS); do \
		os=$${os_arch%%/*}; \
		arch=$${os_arch##*/}; \
		ext=""; \
		if [ "$$os" = "windows" ]; then ext=".exe"; fi; \
		out="bin/gcopy-$(VERSION)-$$os-$$arch$$ext"; \
		echo "Building $$out ..."; \
		CGO_ENABLED=$(CGO_ENABLED) GOOS=$$os GOARCH=$$arch go build \
			-o "$$out" \
			-ldflags '-s -w -X $(PKG)/pkg/version.version=$(VERSION)' \
			./cmd; \
	done

package-release: bin/gcopy
	@rm -rf dist && mkdir -p dist
	@for os_arch in $(OS_ARCHS); do \
		os=$${os_arch%%/*}; \
		arch=$${os_arch##*/}; \
		stage="dist/gcopy-$(VERSION)-$$os-$$arch"; \
		mkdir -p "$$stage"; \
		cp LICENSE.md README.md "$$stage/"; \
		if [ "$$os" = "windows" ]; then \
			cp "bin/gcopy-$(VERSION)-$$os-$$arch.exe" "$$stage/gcopy.exe"; \
			(cd dist && zip -qr "gcopy-$(VERSION)-$$os-$$arch.zip" "gcopy-$(VERSION)-$$os-$$arch"); \
		else \
			cp "bin/gcopy-$(VERSION)-$$os-$$arch" "$$stage/gcopy"; \
			cp scripts/gen-cert.sh "$$stage/gen-cert.sh"; \
			chmod +x "$$stage/gcopy" "$$stage/gen-cert.sh"; \
			tar -C dist -czf "dist/gcopy-$(VERSION)-$$os-$$arch.tar.gz" "gcopy-$(VERSION)-$$os-$$arch"; \
		fi; \
		rm -rf "$$stage"; \
	done
	@(cd dist && (sha256sum *.tar.gz *.zip 2>/dev/null || shasum -a 256 *.tar.gz *.zip) > checksums.txt)
	@ls -lh dist/

push-container: clean
	docker buildx create --platform $(DOCKER_PLATFORMS) --use
	docker buildx build --push --platform $(DOCKER_PLATFORMS) --build-arg VERSION=$(VERSION) -t $(GCOPY_IMAGE_REPO):$(TAG) -t $(GCOPY_IMAGE_REPO):latest -f build/Dockerfile .

clean:
	rm -rf bin/ dist/
	rm -rf $(STATIC_DIR)
	mkdir -p $(STATIC_DIR)
	touch $(STATIC_DIR)/.gitkeep
	rm -f coverage.out

gomod:
	go mod tidy
	go mod vendor
	go mod verify

release:
	@if [ -z "$(NEW_VERSION)" ]; then echo "Usage: make release NEW_VERSION=vX.Y.Z"; exit 1; fi
	@echo $(NEW_VERSION) > version.txt
	$(MAKE) version
	git add version.txt frontend/package.json frontend/package-lock.json
	git commit -m "release $(NEW_VERSION)"
	git tag -a $(NEW_VERSION) -m "$(NEW_VERSION)"
	@echo "Created tag $(NEW_VERSION). Push with: git push origin main --tags"

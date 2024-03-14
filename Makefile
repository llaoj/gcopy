.PHONY: all \
        vet fmt version test e2e-test \
        build-binaries build-container build-tar build \
        docker-builder build-in-docker \
        push-container push-tar push release clean depup

VERSION?=$(shell if [ -d .git ]; then echo `git describe --tags --dirty`; else echo "UNKNOWN"; fi)

# PKG is the package name of gcopy repo.
PKG:=github.com/llaoj/gcopy

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

clean:
	rm -rf output/
	rm -f coverage.out

.PHONY: gomod
gomod:
	go mod tidy
	go mod vendor
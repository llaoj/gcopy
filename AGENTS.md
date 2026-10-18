# AGENTS.md

Notes for working in this repo. Read this before running builds/tests.

## Project layout

- `internal/` — Go backend (Gin). `cmd/gcopy.go` is the entrypoint.
- `frontend/` — Next.js app (App Router), statically exported into the Go binary.
- `vendor/` — Go vendored deps; run `make gomod` after changing `go.mod`.
- `internal/static/dist/` — embedded frontend build output (gitignored; produced by `make frontend-build`).

## Dev environment

- `./scripts/dev.sh` starts **Next dev on :3375** (HTTPS, self-signed) and the **Go backend on :3376**, then blocks.
- Access the app at `https://localhost:3375`. The Next dev server proxies `/api/*` to the Go backend via `next.config.js` rewrites (`SERVER_URL`).

## IMPORTANT: never run `next build` while `next dev` is running

`next dev` and `next build` **share `frontend/.next`**. Running `npm run build` during dev overwrites the dev server's cache and breaks the running page (you then have to restart `./scripts/dev.sh`).

Do **not** try to fix this with `distDir`. With `output: 'export'`, Next ignores a custom `distDir` for the build dir — see `next/dist/build/index.js`:

```js
if (hasCustomExportOutput(config)) {
  configOutDir = config.distDir; // export dir becomes distDir
  config.distDir = ".next";      // build intermediate is forced back to .next
}
```

So a custom `distDir` would only move the export out of `out/` and break `make frontend-build`.

### What to run instead

- During dev, verify frontend changes with:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run typecheck` (`tsc --noEmit`, does not touch `.next`)
- Run a real production build only when dev is stopped, or let the Makefile/CI do it:
  - `make bin/gcopy` (runs `make frontend-build` → exports to `frontend/out`, copies to `internal/static/dist`, then `go build`).

## Backend checks

```bash
go build ./...
go vet ./...
go test ./...        # Makefile: make test (also runs vet + gofmt + prettier)
```

## Formatting

- Go: `gofmt -s -w <files>` (and `make fmt`).
- Frontend: `cd frontend && npx prettier --write <files>`.

## Auth

- Token-only. There is **no** `-auth-mode` / `-smtp-*` config anymore; the token is 8 chars and reservations are tracked in an in-memory registry.

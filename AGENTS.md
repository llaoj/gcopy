# AGENTS.md

Notes for working in this repo. Read this before running builds/tests.

## Project layout

- `internal/` — Go backend (Gin). `cmd/gcopy.go` is the entrypoint.
- `frontend/` — Next.js app (App Router), statically exported into the Go binary.
- `docs/` — VitePress documentation site (`docs.gcopy.link`); build/preview via `make docs-build` / `make docs-dev`.
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
  - `cd frontend && npm test` (compiles `tests/` to temporary `.test-dist/` and runs `node --test`, does not touch `.next`)
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

## Domain vocabulary & naming conventions

Use the established domain terms consistently across Go and TypeScript. Prefer plain, self-explanatory names over terse abbreviations.

### Core domain glossary

- **`Clipboard`** (`gcopy.Clipboard` in Go, `Clipboard` in TS) — a synchronized clipboard payload:
  - `index` (`Index int` in Go, `index: number` in TS) — monotonic per-user version (`1, 2, ...`; `0` means empty). Always numeric in Go, TypeScript models, `ClipboardCursor`, and SSE JSON; stringify only at the HTTP `X-Index` header boundary.
  - `blobId` (`blobId: string` in TS) — 16-char SHA-256 hex prefix (`hashBlob`) used for client-side content deduplication.
  - `type` (`gcopy.TypeText` / `TypeScreenshot` / `TypeFile` in Go, `ClipboardType = "text" | "screenshot" | "file"` in TS).
  - `fileName` (`FileName string` in Go, `fileName?: string` in TS) — file name when `type === "file"` (URL-encoded in `X-FileName`).
  - `clientName` (`ClientName string` in Go, `clientName?: string` in TS) — `<OS> <Browser>` or CLI client name.
  - `data` (`Data []byte` in Go, `data: Blob` in TS) and `mimeType` (`MIMEType string` in Go).
- **`Wall`** (`internal/server/wall.go`) — in-memory store of active `clipboards` (`map[string]*gcopy.Clipboard`) keyed by `userID`, bounded by `maxBytes` (LRU via `lastUsed` + `order`) and 24h `ttl`.
- **`Notifier` & `ClipboardEvent`** (`internal/server/notifier.go`, `frontend/hooks/useClipboardEvents.ts`) — realtime SSE pub/sub (`GET /api/v1/clipboard/events`) pushing `{ index, type, clientName }` to active `listeners` per `userID`, consumed on the frontend by `useClipboardEvents`.
- **`ClipboardCursor`** (`frontend/lib/clipboard-cursor.ts`, `loadClipboardCursor` / `saveClipboardCursor`) — per-user local browser sync cursor `{ index, blobId }` persisted in `localStorage` (`gcopy:clipboard:<userId>`).
- **`HistoryItemEntity`** (`frontend/models/history.ts`) — local IndexedDB (`GCopyDB.history`) entry extending `Clipboard` (`dataArrayBuffer`, `dataType`, `createdAt`, `pin`).
- **User identity (`token` / `userID` / `userId`)** — an 8-character alphanumeric `token` identifies a shared clipboard space:
  - Wire JSON and session keys use camelCase `"userId"` and `"loggedIn"` (`auth.SessionKeyUserID`, `auth.SessionKeyLoggedIn`).
  - Go identifiers use idiomatic `userID` (`GetUserIDFromSession`, `getUserIDFromContext`); TypeScript identifiers use `userId`.
- **Protocol headers** (`internal/gcopy/constants.go`) — `gcopy.HeaderIndex` (`X-Index`), `gcopy.HeaderType` (`X-Type`), `gcopy.HeaderFileName` (`X-FileName`), `gcopy.HeaderClientName` (`X-ClientName`).

### Naming rules

- **No cryptic abbreviations**: Write full domain names (`clipboard` / `clipboards`, `index`, `blobId`, `type`, `fileName`, `clientName`, `userID` / `userId`, `listener` / `listeners`, `order`). Never introduce shorthand or legacy leftovers such as `cb`, `cbs`, `ci`, `cbi`, `sub`, `subject`, `userKey`, `seq`, `xtype`, `xindex`, `xfilename`, `xclientname`, or `tmp*`.
- **Nullable state over dummy sentinels**: Represent absent pending data with `T | null` (e.g. `pendingClipboard: Clipboard | null`), never fake empty placeholder objects (`initTmp*`).
- **React props, handlers, and state**:
  - Callback props use `on*` (`onSync`, `onCancelPrompt`, `onFilesChange`, `onShare`, `onChange`); internal event handlers use `handle*` (`handleSync`, `handlePaste`, `handleFilesChange`). Avoid `*Func` props or `*Handler` suffixes on non-event functions.
  - Boolean UI states name the active condition (`syncing`, `uploading`, `sharing`, `loggingOut`, `submitting`), not generic mechanics like `clicked`.
- **Direct data structures**: Keep Go types flat and readable (e.g. `Wall` directly holding `clipboards`) without wrapper structs (`wallEntry`) or functional-option boilerplate (`With*Option`) unless genuinely required.

## Engineering principles

- Keep helpers single-purpose. A function named `push*` / `upload*` should only perform that operation. Do not hide local persistence or shared-state mutations inside low-level network helpers.
- Let callers own state transitions. Different callers often need different semantics (for example, sharing a history item advances the server index but must not change the local clipboard hash), so update state at each call site or in a dedicated state helper.
- If a helper intentionally mutates state, its name and contract must say so explicitly. Otherwise return the result (e.g. `{ index, blobId }`) and let the caller decide what to persist.
- Keep GCopy scoped strictly to clipboard synchronization and its own internal resource bounds (e.g. `Wall` memory limits). Do **not** add edge/gateway concerns such as HTTP rate limiting, IP/WAF filtering, or `X-Forwarded-For` / proxy header parsing into the application layer — those belong at the edge gateway (Cloudflare, Nginx, Caddy, Istio, etc.).

## Auth

- Token-only. There is **no** `-auth-mode` / `-smtp-*` config anymore; the token is 8 chars and reservations are tracked in an in-memory registry.

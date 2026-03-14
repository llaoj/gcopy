# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GCopy is a clipboard synchronization service that allows sharing clipboard data (text, screenshots, files) between different operating systems via a web browser. It uses in-memory storage with 24-hour expiration and email-based authentication.

## Architecture

### Backend (Go + Gin)
- **Entry point**: `cmd/gcopy.go`
- **Server**: `internal/server/server.go` - Gin HTTP server with routes for clipboard sync and user auth
- **Clipboard storage**: `internal/server/wall.go` - In-memory storage using `sync.Map`, with automatic expiration after 24 hours
- **Authentication**: `internal/server/user.go` - Email-based auth with 6-digit verification codes (5-minute expiration), sessions stored via cookies
- **Configuration**: `internal/config/` - Command-line flag parsing for SMTP, TLS, and app settings
- **Clipboard types**: `internal/gcopy/constants.go` defines three types: `text`, `screenshot`, `file`

### Frontend (Next.js + React)
- **Entry**: `frontend/app/[locale]/page.tsx` - Main page with sync functionality
- **Key libraries**:
  - `frontend/lib/clipboard.ts` - Clipboard API interactions (read/write blobs)
  - `frontend/lib/auth.ts` - SWR-based authentication state management
- **API proxy**: `frontend/next.config.js` rewrites `/api/v1/*` to backend `SERVER_URL`
- **i18n**: Uses `next-intl` for internationalization

### Data Flow
1. User logs in via email verification code
2. Session stored in cookie (managed by `gorilla/sessions`)
3. Clipboard data is stored per-email in the Wall (in-memory map)
4. Each clipboard update increments an index for conflict detection
5. **Manual sync**: User clicks sync button (or uses keyboard shortcut) to pull/push clipboard data
6. Frontend tracks state via URL query params: `ci` (clipboard index) and `cbi` (clipboard blob ID hash)

## Development Commands

### Backend
```bash
# Run directly (development)
go run cmd/gcopy.go \
  -app-key=<app-key> \
  -smtp-host=<smtp-host> \
  -smtp-port=<smtp-port> \
  -smtp-username=<smtp-username> \
  -smtp-password=<smtp-password> \
  -smtp-ssl \
  -debug

# Build binary
make ./bin/gcopy

# Run tests
make test

# Format and vet
make vet fmt
```

### Frontend
```bash
cd frontend

# Install dependencies
npm ci

# Development (with HTTPS on port 3375)
npm run dev

# Build for production
npm run build
cp -r .next/static .next/standalone/.next/
NODE_ENV=production PORT=3375 node .next/standalone/server.js

# Lint
npm run lint

# Format
npm run prettier
```

### Testing
```bash
# Run all Go tests
make test

# Run specific package tests
go test -v ./pkg/utils/...

# Run single test
go test -v -run TestFunctionName ./path/to/package
```

### Version Management
When updating the project version:

1. **Modify version.txt file**: Update the version number directly (e.g., `v1.5.0`)
2. **Run sync command**: Execute `make version` to sync the version to frontend package.json and format code

**Example**:
```bash
# 1. Edit version.txt file to change version to v1.5.0
# 2. Run sync command
make version
```

**Note**: Do NOT manually edit frontend/package.json version number. Always use `make version` to sync automatically.

### Frontend History Storage
- Uses IndexedDB via Dexie (`frontend/models/db.ts`)
- Stores up to 20 non-pinned items (auto-deletes older items)
- Stores `dataArrayBuffer` separately to fix Safari WebKitBlobResource error
- Each item has: `createdAt`, `pin` (true/false), `index`, `blobId`, `data`, `type`, `fileName`

## Key Configuration

### Backend Flags
- `-app-key`: Encryption key for sessions (required, min 8 chars)
- `-auth-mode`: Authentication mode: `email` or `token` (default `email`)
- `-smtp-*`: Email service configuration (host, port, username, password, ssl, sender) - required for email mode only
- `-listen`: Server address (default `:3376`)
- `-max-content-length`: Max clipboard size in MiB (default 10)
- `-debug`: Enable debug logging

**Note**: TLS is handled by reverse proxy (e.g., Nginx), not by GCopy backend. Do not use `-tls`, `-tls-cert-file`, or `-tls-key-file` flags.

### Docker Deployment
GCopy uses a **single Docker image** that contains both frontend and backend:
- Built from `build/Dockerfile` using multi-stage build
- Frontend built with Next.js standalone mode
- Backend compiled as Go binary
- Uses supervisord for process management
- Only exposes port 3375 (frontend port)
- Frontend proxies API requests to backend internally on port 3376

**Environment Variables** (use `GCOPY_` prefix to avoid conflicts):
- `GCOPY_APP_KEY`: Encryption key (required)
- `GCOPY_AUTH_MODE`: Authentication mode
- `GCOPY_SMTP_*`: SMTP configuration
- `GCOPY_LISTEN`: Backend listen address
- `GCOPY_MAX_CONTENT_LENGTH`: Max clipboard size
- `GCOPY_DEBUG`: Enable debug mode

**Log Differentiation**:
- Frontend logs prefixed with `[frontend]`
- Backend logs prefixed with `[backend]`

### Frontend Environment
- `SERVER_URL`: Backend API URL (default in `.env.sample`: `http://gcopy:3376`)
- `.env.local` for development, `.env.production` for production
- Development server uses self-signed certificates for HTTPS (required for Clipboard API)

## Important Implementation Details

### Clipboard Synchronization Flow
**Manual Sync Mechanism** (NOT automatic polling):
1. User clicks "Sync" button or uses keyboard shortcut (Enter, Cmd+1 on Mac, Ctrl+1 on other OS)
2. Frontend calls `syncFunc()` which:
   - First attempts to pull from server (`pullClipboard()`)
   - If server has no new data (same index), automatically pushes local clipboard (`pushClipboard()`)
   - Safari exception: Requires two button presses due to clipboard API restrictions

**Pull Flow** (`pullClipboard()`):
- GET `/api/v1/clipboard` with `X-Index` header from URL param `ci`
- If server index matches local index: returns 200 with same index (no new data)
- If new data available:
  - Downloads blob and writes to clipboard
  - Updates URL params: `ci` (new index), `cbi` (blob hash)
  - Adds to IndexedDB history
  - For Safari: sets `status="interrupted-w"`, requires second click to write clipboard

**Push Flow** (`pushClipboard()`):
- Reads from quick-input textarea OR clipboard (textarea takes priority if not empty)
- Determines type by MIME:
  - `text/plain`, `text/html`, `text/uri-list` → `text` (converts to text/plain)
  - `image/png` → `screenshot`
  - Other types → error (unsupported format)
- POST `/api/v1/clipboard` with `X-Type`, `X-FileName` headers and blob body
- Updates URL params with new index and blob hash
- Adds to IndexedDB history
- Clears quick-input textarea after successful upload

**State Tracking via URL**:
- `?ci=<index>&cbi=<blob-hash>`: Track current clipboard state
- Prevents re-downloading same content
- Enables conflict detection

**Safari Special Handling**:
- Requires user gesture for each Clipboard API call
- Two-step process: first click fetches data, second click writes to clipboard
- Status states: `interrupted-r` (need to push), `interrupted-w` (need to write)

**Android Chrome/Edge Bug**:
- Cannot read clipboard immediately after writing
- Waits 1 second before reading back to verify

### Backend Clipboard Storage
- In-memory `sync.Map` keyed by user email
- Each clipboard: `Index` (incremental), `Type`, `Data` ([]byte), `FileName`, `MIMEType`, `ClientName`, `CreatedAt`
- Housekeeping goroutine runs every minute, deletes clipboards older than 24 hours
- No persistence - data lost on server restart

### Authentication Flow
1. POST `/api/v1/user/email-code` - Send 6-digit code to email
   - Generates random 6-digit code
   - Stores in session: `email`, `code`, `loggedIn=false`, `validateAt`
   - Sends email via SMTP with localized message (zh-CN or English)
2. POST `/api/v1/user/login` - Verify code
   - Checks: email matches, code matches, within 5 minutes of `validateAt`
   - Sets `loggedIn=true` in session
3. GET `/api/v1/user` - Check session status
   - Returns `email` and `loggedIn` status
4. GET `/api/v1/user/logout` - Clear session
   - Deletes all session values

**Session Management**:
- Uses `gorilla/sessions` with cookie store
- Cookie name: `user_session`
- Encrypted with `-app-key` flag value
- Sessions validated on each clipboard API request via `verifyAuthMiddleware`

### File Synchronization
**Upload**:
- Drag & drop or file picker triggers `uploadFileHandler()`
- POST `/api/v1/clipboard` with `X-Type: file` and `X-FileName` (URI encoded)
- File sent as request body
- Updates URL param `ci` only (no clipboard write)
- Displays download link on success

**Download**:
- Pull flow detects `X-Type: file` header
- Decodes `X-FileName` from header
- Creates `File` object and blob URL
- Displays download link (does NOT write to clipboard due to browser limitations)

### Frontend Architecture Details
**Browser Detection**:
- Uses `react-device-detect` for OS/browser-specific logic
- Safari: Requires two-step clipboard operations
- Android Chrome/Edge: Delayed clipboard read after write

**Quick Input**:
- Textarea for manual text input
- If not empty, uses textarea value instead of reading clipboard
- Cleared after successful push

**History Management**:
- IndexedDB via Dexie ORM
- Stores up to 20 recent items (pinned items kept separately)
- Auto-converts blob to ArrayBuffer for Safari compatibility
- Displays pinned items first, then recent items

**Keyboard Shortcuts**:
- Desktop only: Enter, Cmd+1 (Mac), Ctrl+1 (other OS)
- Triggers sync button click

## Browser Compatibility
Depends on Clipboard API (requires HTTPS). Tested on Chrome, Edge, Opera, Safari (macOS/iOS), and mobile browsers. See README for specific versions.

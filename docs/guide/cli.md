# CLI, SSH & iOS Shortcuts

In addition to browser sessions, GCopy natively accepts `Authorization: Bearer <TOKEN>` on `/api/v1/clipboard`. You can synchronize text, command outputs, screenshots, and files straight from headless Linux SSH servers, shell scripts, or iOS Shortcuts — with **zero extra CLI binaries to install**.

## 1. Sync via `curl` (SSH / Terminal)

Replace `G8K2P9X4` with your 8-character token (and `https://gcopy.link` with your self-hosted URL if applicable).

### Push text or command output to your clipboard

```bash
# Pipe any command output or text straight to GCopy
echo "Hello from SSH server!" | curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  --data-binary @-
```

Now click **Sync clipboard** in your local browser and paste (`Ctrl+V` / `Cmd+V`)!

### Pull the latest clipboard into your terminal

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4"
```

### Push a file from a remote server

Pass `X-FileName` (percent-encoded if it contains spaces or non-ASCII characters) and GCopy automatically treats the payload as a downloadable file:

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  -H "X-FileName: app.log" \
  --data-binary @/var/log/app.log
```

### Push an image as a clipboard screenshot

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  -H "Content-Type: image/png" \
  --data-binary @diagram.png
```

---

## 2. Handy Shell Functions (`gpush` / `gpull`)

Drop this snippet into `~/.bashrc` or `~/.zshrc` on your servers (compatible with both `bash` and `zsh`, including `set -u`, spaces, and UTF-8 filenames):

```bash
export GCOPY_URL="https://gcopy.link"
export GCOPY_TOKEN="G8K2P9X4"

# Usage:
#   cat config.yaml | gpush        (push stdin text)
#   gpush ./report.tar.gz          (push any file, UTF-8/spaces safe)
gpush() {
  if [ -n "${1:-}" ]; then
    if [ ! -f "$1" ]; then
      echo "gpush: file not found: $1" >&2
      return 1
    fi
    local raw_name encoded_name
    raw_name=$(basename "$1")
    encoded_name=$(printf '%s' "$raw_name" | LC_ALL=C od -An -tx1 -v | tr ' ' '\n' | awk 'NF { printf "%%%s", toupper($1) }')
    curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
      -H "Authorization: Bearer $GCOPY_TOKEN" \
      -H "X-FileName: $encoded_name" \
      --data-binary "@$1" >/dev/null
  else
    curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
      -H "Authorization: Bearer $GCOPY_TOKEN" \
      --data-binary @- >/dev/null
  fi
}

# Usage:
#   gpull                          (print text clipboard to stdout)
#   gpull > archive.tar.gz         (save binary/file clipboard)
gpull() {
  curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
    -H "Authorization: Bearer $GCOPY_TOKEN"
}
```

---

## 3. iOS Shortcuts (iPhone / iPad)

You can wire GCopy into Apple's built-in **Shortcuts** app so you can push or pull without opening Safari.

> [!IMPORTANT]
> Follow the exact action types below to avoid two common iOS Shortcuts pitfalls:
> 1. Passing a copied Safari **URL** directly into a `File` body causes iOS Shortcuts to fetch and upload the webpage's HTML instead of the URL string — adding **Get Text from Input** first prevents this.
> 2. Photos copied from the iOS Photos app default to `HEIC`, which Windows browsers cannot decode on the clipboard — adding **Convert Image → PNG** ensures cross-platform compatibility.

### Shortcut A: Push Text / Links (iPhone → PC/Mac)
1. **Get Clipboard**
2. **Get Text from Input** (input: `Clipboard`)
3. **Get Contents of URL** (`https://gcopy.link/api/v1/clipboard`)
   - **Method**: `POST`
   - **Headers**: `Authorization`: `Bearer G8K2P9X4`
   - **Request Body**: `File` → select `Text` (from Step 2)

### Shortcut B: Push Screenshot / Image (iPhone → PC/Mac)
1. **Get Clipboard**
2. **Convert Image** (input: `Clipboard`, format: **PNG**)
3. **Get Contents of URL** (`https://gcopy.link/api/v1/clipboard`)
   - **Method**: `POST`
   - **Headers**: `Authorization`: `Bearer G8K2P9X4` *(do not set `Content-Type` manually; Shortcuts sets `image/png` automatically)*
   - **Request Body**: `File` → select `Converted Image`

### Shortcut C: Pull Clipboard (PC/Mac → iPhone)
1. **Get Contents of URL** (`https://gcopy.link/api/v1/clipboard`, Method: `GET`, Header: `Authorization`: `Bearer G8K2P9X4`)
2. **If** `Contents of URL` **has any value**:
   - **Copy to Clipboard** (`Contents of URL`) — works for both text and PNG screenshots!

> [!TIP]
> Bind your Shortcut to **Settings → Accessibility → Touch → Back Tap (Double Tap)** on iPhone to push or pull your clipboard from any app with a quick double-tap.

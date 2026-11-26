// The local clipboard sync cursor: `index` is the server clipboard version this
// browser last synced, and `blobId` is the SHA-256 prefix hash of the content.
// Both are small and shared by all tabs of this browser profile, so localStorage
// matches the "one clipboard per computer" model and keeps the cursor across
// reloads and browser restarts.
const STORAGE_PREFIX = "gcopy:clipboard";

export interface ClipboardCursor {
  index: number;
  blobId: string;
}

export function loadClipboardCursor(userId?: string): ClipboardCursor {
  if (!userId || typeof window === "undefined") {
    return { index: 0, blobId: "" };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) {
      return { index: 0, blobId: "" };
    }

    // Read legacy `{ ci, cbi }` keys as fallback so existing sessions upgrade smoothly.
    const parsed = JSON.parse(raw) as Partial<ClipboardCursor> & {
      ci?: number;
      cbi?: string;
    };
    const rawIndex = Number(parsed.index ?? parsed.ci);
    const index =
      Number.isFinite(rawIndex) && rawIndex > 0 ? Math.floor(rawIndex) : 0;
    const rawBlobId = parsed.blobId ?? parsed.cbi;
    return {
      index,
      blobId: index > 0 && typeof rawBlobId === "string" ? rawBlobId : "",
    };
  } catch {
    // Corrupt data or storage unavailable: fall back to the empty cursor.
    return { index: 0, blobId: "" };
  }
}

export function saveClipboardCursor(
  userId: string | undefined,
  cursor: ClipboardCursor,
): void {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    const index =
      Number.isFinite(cursor.index) && cursor.index > 0
        ? Math.floor(cursor.index)
        : 0;
    const blobId =
      index > 0 && typeof cursor.blobId === "string" ? cursor.blobId : "";
    window.localStorage.setItem(
      `${STORAGE_PREFIX}:${userId}`,
      JSON.stringify({ index, blobId }),
    );
  } catch {
    // localStorage may be unavailable (private mode, quota); sync still works,
    // it just loses the dedup cursor.
  }
}

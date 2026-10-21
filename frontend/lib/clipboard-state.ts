// The clipboard sync cursor: `ci` is the server version, `cbi` is the hash of
// the content this device last synced. Both are small and shared by all tabs of
// this browser profile, so localStorage matches the "one clipboard per computer"
// model and keeps the state across reloads and browser restarts.
const PREFIX = "gcopy:clipboard";

export interface ClipboardState {
  ci: number;
  cbi: string;
}

export function loadClipboardState(userId?: string): ClipboardState {
  if (!userId || typeof window === "undefined") {
    return { ci: 0, cbi: "" };
  }

  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${userId}`);
    if (!raw) {
      return { ci: 0, cbi: "" };
    }

    const parsed = JSON.parse(raw) as Partial<ClipboardState>;
    const ci = Number(parsed.ci);
    const validCi = Number.isFinite(ci) && ci > 0 ? Math.floor(ci) : 0;
    return {
      ci: validCi,
      cbi: validCi > 0 && typeof parsed.cbi === "string" ? parsed.cbi : "",
    };
  } catch {
    // Corrupt data or storage unavailable: fall back to the empty state.
    return { ci: 0, cbi: "" };
  }
}

export function saveClipboardState(
  userId: string | undefined,
  state: ClipboardState,
): void {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    const ci =
      Number.isFinite(state.ci) && state.ci > 0 ? Math.floor(state.ci) : 0;
    const cbi = ci > 0 && typeof state.cbi === "string" ? state.cbi : "";
    window.localStorage.setItem(
      `${PREFIX}:${userId}`,
      JSON.stringify({ ci, cbi }),
    );
  } catch {
    // localStorage may be unavailable (private mode, quota); sync still works,
    // it just loses the dedup state.
  }
}

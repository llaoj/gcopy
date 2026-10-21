import { Clipboard } from "@/lib/clipboard";

export const HISTORY_RECENT_LIMIT = 20;
export const HISTORY_PIN_LIMIT = 10;

export interface HistoryItemEntity extends Omit<Clipboard, "data"> {
  createdAt?: string;
  pin?: string;
  // Fix error on Safari: Failed to load resource: The operation couldn’t be completed. (WebKitBlobResource error 1.)
  // https://stackoverflow.com/questions/68386273/error-loading-blob-to-img-in-safari-webkitblobresource-error-1
  dataArrayBuffer?: ArrayBuffer;
  dataType?: string;
}

export function createdAtMs(createdAt?: string): number {
  if (!createdAt) return 0;
  const ms = Date.parse(createdAt);
  return Number.isNaN(ms) ? 0 : ms;
}

export function sortByCreatedAtDesc<T extends { createdAt?: string }>(
  items: T[],
): T[] {
  return items.sort(
    (a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt),
  );
}

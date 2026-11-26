import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  loadClipboardCursor,
  saveClipboardCursor,
} from "../lib/clipboard-cursor";

class MemoryStorage {
  private store = new Map<string, string>();
  throwOnSet = false;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error("QuotaExceededError");
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("clipboard-cursor", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    (globalThis as { window?: unknown }).window = {
      localStorage: storage,
    };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("returns empty cursor when userId is missing or storage has no entry", () => {
    assert.deepEqual(loadClipboardCursor(undefined), { index: 0, blobId: "" });
    assert.deepEqual(loadClipboardCursor(""), { index: 0, blobId: "" });
    assert.deepEqual(loadClipboardCursor("G8K2P9X4"), { index: 0, blobId: "" });
  });

  it("saves and loads cursor isolated per userId", () => {
    saveClipboardCursor("USER0001", { index: 5, blobId: "8f3c1a9b20e47d12" });
    saveClipboardCursor("USER0002", { index: 2, blobId: "0011223344556677" });

    assert.deepEqual(loadClipboardCursor("USER0001"), {
      index: 5,
      blobId: "8f3c1a9b20e47d12",
    });
    assert.deepEqual(loadClipboardCursor("USER0002"), {
      index: 2,
      blobId: "0011223344556677",
    });
  });

  it("migrates legacy { ci, cbi } localStorage payloads seamlessly", () => {
    storage.setItem(
      "gcopy:clipboard:G8K2P9X4",
      JSON.stringify({ ci: 7, cbi: "legacyhash123456" }),
    );

    assert.deepEqual(loadClipboardCursor("G8K2P9X4"), {
      index: 7,
      blobId: "legacyhash123456",
    });
  });

  it("sanitizes non-positive or fractional index and corrupt JSON", () => {
    saveClipboardCursor("G8K2P9X4", { index: 3.9, blobId: "floored" });
    assert.deepEqual(loadClipboardCursor("G8K2P9X4"), {
      index: 3,
      blobId: "floored",
    });

    saveClipboardCursor("G8K2P9X4", { index: -4, blobId: "discarded" });
    assert.deepEqual(loadClipboardCursor("G8K2P9X4"), {
      index: 0,
      blobId: "",
    });

    storage.setItem("gcopy:clipboard:G8K2P9X4", "{corrupt-json");
    assert.deepEqual(loadClipboardCursor("G8K2P9X4"), {
      index: 0,
      blobId: "",
    });
  });

  it("swallows localStorage quota errors without throwing", () => {
    storage.throwOnSet = true;
    assert.doesNotThrow(() => {
      saveClipboardCursor("G8K2P9X4", { index: 1, blobId: "abc" });
    });
  });
});

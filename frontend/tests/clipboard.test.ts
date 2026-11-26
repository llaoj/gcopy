import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  ClipboardPermissionError,
  clipboardRead,
  hashBlob,
  isClipboardType,
  isValidURL,
  toTextBlob,
} from "../lib/clipboard";

describe("clipboard utilities", () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    }
  });

  it("validates ClipboardType values", () => {
    assert.equal(isClipboardType("text"), true);
    assert.equal(isClipboardType("screenshot"), true);
    assert.equal(isClipboardType("file"), true);
    assert.equal(isClipboardType("video"), false);
    assert.equal(isClipboardType(""), false);
    assert.equal(isClipboardType(null), false);
    assert.equal(isClipboardType(undefined), false);
  });

  it("computes deterministic 16-char SHA-256 hex digest for Blobs", async () => {
    const first = await hashBlob(
      new Blob(["hello gcopy"], { type: "text/plain" }),
    );
    const second = await hashBlob(
      new Blob(["hello gcopy"], { type: "text/plain" }),
    );
    const different = await hashBlob(
      new Blob(["other payload"], { type: "text/plain" }),
    );

    assert.match(first, /^[0-9a-f]{16}$/);
    assert.equal(first, second);
    assert.notEqual(first, different);
  });

  it("normalizes non-plain Blobs into text/plain via toTextBlob", async () => {
    const plain = new Blob(["already plain"], { type: "text/plain" });
    assert.equal(toTextBlob(plain), plain);

    const html = new Blob(["<b>rich</b>"], { type: "text/html" });
    const converted = await toTextBlob(html);
    assert.equal(converted.type, "text/plain");
    assert.equal(await converted.text(), "<b>rich</b>");
  });

  it("accepts only safe http/https/ftp URLs in isValidURL", () => {
    assert.equal(isValidURL("https://gcopy.link/path?q=1"), true);
    assert.equal(isValidURL("http://localhost:3375"), true);
    assert.equal(isValidURL("ftp://files.example.com/pub"), true);
    assert.equal(isValidURL("javascript:alert(1)"), false);
    assert.equal(isValidURL("data:text/html,<h1>x</h1>"), false);
    assert.equal(isValidURL("not a url"), false);
  });

  it("reads clipboard items prioritizing images over text and handles permission errors", async () => {
    const setMockClipboardRead = (readFn: () => Promise<unknown[]>) => {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          clipboard: {
            read: readFn,
          },
        },
      });
    };

    // 1. Empty items or empty types (e.g. WeChat raw image) returns null.
    setMockClipboardRead(async () => []);
    assert.equal(await clipboardRead(), null);

    setMockClipboardRead(async () => [
      { types: [], getType: async () => new Blob() },
    ]);
    assert.equal(await clipboardRead(), null);

    // 2. Prioritizes image/png over text/plain when both exist.
    const pngBlob = new Blob(["png"], { type: "image/png" });
    const textBlob = new Blob(["txt"], { type: "text/plain" });
    setMockClipboardRead(async () => [
      {
        types: ["text/plain", "image/png"],
        getType: async (type: string) =>
          type === "image/png" ? pngBlob : textBlob,
      },
    ]);
    assert.equal(await clipboardRead(), pngBlob);

    // 3. Reads text/plain when no image is present.
    setMockClipboardRead(async () => [
      {
        types: ["text/plain"],
        getType: async () => textBlob,
      },
    ]);
    assert.equal(await clipboardRead(), textBlob);

    // 4. Translates DOMException NotAllowedError into ClipboardPermissionError.
    setMockClipboardRead(async () => {
      throw new DOMException("Denied", "NotAllowedError");
    });
    await assert.rejects(clipboardRead(), ClipboardPermissionError);
  });
});

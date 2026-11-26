import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateFileSize } from "../lib/file-utils";

describe("validateFileSize", () => {
  it("accepts blobs within or equal to maxContentLengthMB", () => {
    const oneMiB = new Blob([new Uint8Array(1024 * 1024)]);
    assert.deepEqual(validateFileSize(oneMiB, 1), { valid: true });
    assert.deepEqual(validateFileSize(new Blob(["small"]), 10), {
      valid: true,
    });
  });

  it("rejects blobs exceeding maxContentLengthMB with formatted message", () => {
    const twoAndHalfMiB = new Blob([
      new Uint8Array(Math.ceil(2.5 * 1024 * 1024)),
    ]);
    const result = validateFileSize(twoAndHalfMiB, 2);
    assert.equal(result.valid, false);
    assert.match(result.message ?? "", /2\.50 MiB.*exceeds.*2 MiB/);
  });
});

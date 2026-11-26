import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unzipSync } from "fflate";
import { createZipFile } from "../lib/zip-files";

describe("createZipFile", () => {
  it("bundles multiple files and deduplicates colliding file names", async () => {
    const files = [
      new File(["alpha"], "report.txt", {
        type: "text/plain",
        lastModified: 0, // pre-1980 timestamp should be clamped safely
      }),
      new File(["beta"], "report.txt", { type: "text/plain" }),
      new File(["gamma"], "report.txt", { type: "text/plain" }),
      new File(["one"], "README", { type: "text/plain" }),
      new File(["two"], "README", { type: "text/plain" }),
    ];

    const zipFile = await createZipFile(files);
    assert.equal(zipFile.type, "application/zip");
    assert.match(zipFile.name, /^gcopy-files-\d{8}-\d{6}\.zip$/);

    const archiveBytes = new Uint8Array(await zipFile.arrayBuffer());
    const entries = unzipSync(archiveBytes);
    const decoder = new TextDecoder();

    assert.deepEqual(Object.keys(entries).sort(), [
      "README",
      "README_1",
      "report.txt",
      "report_1.txt",
      "report_2.txt",
    ]);
    assert.equal(decoder.decode(entries["report.txt"]), "alpha");
    assert.equal(decoder.decode(entries["report_1.txt"]), "beta");
    assert.equal(decoder.decode(entries["report_2.txt"]), "gamma");
    assert.equal(decoder.decode(entries["README"]), "one");
    assert.equal(decoder.decode(entries["README_1"]), "two");
  });
});

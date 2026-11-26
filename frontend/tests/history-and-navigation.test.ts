import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLoginPath, redirectToLogin } from "../lib/navigation";
import { createdAtMs, sortByCreatedAtDesc } from "../models/history";

describe("history model helpers", () => {
  it("parses valid ISO timestamps and returns 0 for missing or invalid dates", () => {
    assert.equal(createdAtMs(undefined), 0);
    assert.equal(createdAtMs(""), 0);
    assert.equal(createdAtMs("not-a-date"), 0);
    assert.equal(
      createdAtMs("2026-11-26T00:00:00.000Z"),
      Date.parse("2026-11-26T00:00:00.000Z"),
    );
  });

  it("sorts history items newest-first", () => {
    const items = [
      { id: "older", createdAt: "2026-11-25T10:00:00.000Z" },
      { id: "missing" },
      { id: "newest", createdAt: "2026-11-26T08:30:00.000Z" },
      { id: "middle", createdAt: "2026-11-25T18:00:00.000Z" },
    ];

    const sorted = sortByCreatedAtDesc(items);
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["newest", "middle", "older", "missing"],
    );
  });
});

describe("navigation helpers", () => {
  it("redirects unauthenticated callers to /user/token", () => {
    assert.equal(getLoginPath(), "/user/token");

    const pushed: string[] = [];
    redirectToLogin({ push: (url) => pushed.push(url) });
    assert.deepEqual(pushed, ["/user/token"]);
  });
});

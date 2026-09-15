import { describe, expect, it } from "vitest";
import { responseCacheTtlMs } from "./resolve-entry";

describe("responseCacheTtlMs", () => {
  it("does not reuse no-store, no-cache, or unspecified HTML responses", () => {
    expect(responseCacheTtlMs(new Headers({ "Cache-Control": "public, no-store" }))).toBe(0);
    expect(responseCacheTtlMs(new Headers({ "Cache-Control": "no-cache" }))).toBe(0);
    expect(responseCacheTtlMs(new Headers())).toBe(0);
  });

  it("uses explicit max-age or Expires response freshness", () => {
    expect(responseCacheTtlMs(new Headers({ "Cache-Control": "public, max-age=300" }))).toBe(300_000);
    expect(responseCacheTtlMs(new Headers({ Expires: "Thu, 01 Jan 1970 00:00:11 GMT" }), 1_000)).toBe(10_000);
  });
});

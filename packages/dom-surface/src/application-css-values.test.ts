import { describe, expect, it } from "vitest";
import { renameFontFamilies, resolveApplicationRem } from "./application-css-values";

describe("application CSS values", () => {
  it("resolves dimensions in calc and variables while preserving strings and resource URLs", () => {
    expect(resolveApplicationRem('calc(2rem + .5rem) var(--size, -1rem)',20)).toBe('calc(40px + 10px) var(--size, -20px)');
    expect(resolveApplicationRem('"2rem" url("icon-2rem.svg") /* 2rem */ 2rem',20)).toBe('"2rem" url("icon-2rem.svg") /* 2rem */ 40px');
  });
  it("renames complete font families without matching substrings in unrelated names", () => {
    const families = new Map([["App Icons", "private-app-icons"]]);
    expect(renameFontFamilies('italic 20px "App Icons", sans-serif',families)).toBe('italic 20px "private-app-icons", sans-serif');
    expect(renameFontFamilies('OtherApp Icons, App IconsExtended',families)).toBe('OtherApp Icons, App IconsExtended');
  });
});

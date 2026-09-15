import { describe, expect, it } from "vitest";
import {
  cspAllowsResource,
  cspAllowsUnsafeEval,
  cspHasReporting,
  parseCspPolicy,
} from "./csp-policy";

describe("CSP policy diagnostics", () => {
  const documentURL = "https://shell.example.com/workspace";

  it("applies directive fallback and host wildcard matching", () => {
    const policy = parseCspPolicy(
      "default-src 'self'; script-src 'self' https://*.apps.example.com; connect-src https:; report-to csp",
    );

    expect(cspAllowsResource(
      policy,
      "script",
      "https://orders.apps.example.com/assets/entry.js",
      documentURL,
    )).toBe(true);
    expect(cspAllowsResource(
      policy,
      "script",
      "https://untrusted.example.net/entry.js",
      documentURL,
    )).toBe(false);
    expect(cspAllowsResource(policy, "style", "/assets/host.css", documentURL)).toBe(true);
    expect(cspHasReporting(policy)).toBe(true);
  });

  it("identifies unsafe-eval without treating nonces as URL sources", () => {
    const policy = parseCspPolicy("default-src 'none'; script-src 'nonce-release' 'unsafe-eval'");

    expect(cspAllowsUnsafeEval(policy)).toBe(true);
    expect(cspAllowsResource(policy, "script", "https://shell.example.com/app.js", documentURL)).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { scanDeployment } from "./deployment-scanner";

interface Route {
  body: string;
  contentType: string;
  cors?: string;
  status?: number;
  vary?: string;
}

function base64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(value >>> 18) & 63];
    output += alphabet[(value >>> 12) & 63];
    output += second === undefined ? "=" : alphabet[(value >>> 6) & 63];
    output += third === undefined ? "=" : alphabet[value & 63];
  }
  return output;
}

async function sri(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-384", bytes);
  return `sha384-${base64(new Uint8Array(digest))}`;
}

function routeFetch(routes: Readonly<Record<string, Route>>): typeof fetch {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const route = routes[url];
    if (!route) return new Response("missing", { status: 404, statusText: "Not Found" });
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: {
        "Content-Type": route.contentType,
        ...(route.cors ? { "Access-Control-Allow-Origin": route.cors } : {}),
        ...(route.vary ? { Vary: route.vary } : {}),
      },
    });
  }) as typeof fetch;
}

describe("deployment scanner", () => {
  it("verifies CSP, CORS, MIME and every schema v2 manifest digest", async () => {
    const host = "https://shell.example.com/";
    const origin = "https://apps.example.com";
    const entry = "export const entry = true;";
    const style = ".app{color:green}";
    const entryIntegrity = await sri(entry);
    const styleIntegrity = await sri(style);
    const manifest = JSON.stringify({
      schemaVersion: 2,
      application: "orders",
      entry: "entry.js",
      chunks: [{
        file: "entry.js",
        entry: true,
        imports: [],
        dynamicImports: [],
        integrity: entryIntegrity,
      }],
      assets: [{ file: "entry.css", integrity: styleIntegrity }],
    });
    const manifestIntegrity = await sri(manifest);
    const cors = "https://shell.example.com";
    const result = await scanDeployment({
      hostUrl: host,
      csp: "default-src 'self'; script-src 'self' https://apps.example.com; style-src 'self' https://apps.example.com; connect-src 'self' https://apps.example.com; report-to csp",
      fetch: routeFetch({
        [host]: { body: "<!doctype html>", contentType: "text/html" },
        [`${origin}/entry.js`]: { body: entry, contentType: "text/javascript", cors, vary: "Origin" },
        [`${origin}/manifest.json`]: { body: manifest, contentType: "application/json", cors, vary: "Origin" },
        [`${origin}/entry.css`]: { body: style, contentType: "text/css", cors, vary: "Origin" },
      }),
      applications: [{
        name: "orders",
        entry: `${origin}/entry.js`,
        type: "module",
        integrity: entryIntegrity,
        manifest: { url: `${origin}/manifest.json`, integrity: manifestIntegrity },
      }],
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toHaveLength(5);
    expect(result.resources.filter(({ integrityVerified }) => integrityVerified)).toHaveLength(4);
  });

  it("returns actionable diagnostics for a blocked and mutated module", async () => {
    const host = "https://shell.example.com/";
    const entryURL = "https://apps.example.com/entry.js";
    const expectedIntegrity = await sri("expected");
    const result = await scanDeployment({
      hostUrl: host,
      csp: "default-src 'self'; script-src 'self'; connect-src 'self'",
      fetch: routeFetch({
        [host]: { body: "<!doctype html>", contentType: "text/html" },
        [entryURL]: { body: "mutated", contentType: "text/plain" },
      }),
      applications: [{ name: "orders", entry: entryURL, type: "module", integrity: expectedIntegrity }],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "cors-missing",
      "content-type-invalid",
      "integrity-mismatch",
      "csp-blocked-script",
      "csp-reporting-missing",
    ]));
  });

  it("rejects an invalid manifest and missing integrity metadata", async () => {
    const host = "https://shell.example.com/";
    const entryURL = "https://shell.example.com/entry.js";
    const manifestURL = "https://shell.example.com/manifest.json";
    const result = await scanDeployment({
      hostUrl: host,
      csp: "default-src 'self'; report-uri /csp-report",
      fetch: routeFetch({
        [host]: { body: "<!doctype html>", contentType: "text/html" },
        [entryURL]: { body: "export default {};", contentType: "text/javascript" },
        [manifestURL]: { body: "{}", contentType: "application/json" },
      }),
      applications: [{
        name: "orders",
        entry: entryURL,
        type: "module",
        manifest: { url: manifestURL },
      }],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "integrity-missing",
      "manifest-invalid",
    ]));
  });
});

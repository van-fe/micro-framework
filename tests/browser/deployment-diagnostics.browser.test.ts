import {
  installBrowserReportCollector,
  scanDeployment,
  type BrowserPolicyReport,
} from "@micro-framework/deployment-diagnostics";
import { afterEach, describe, expect, it } from "vitest";

const frames = new Set<HTMLIFrameElement>();

function base64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

afterEach(() => {
  for (const frame of frames) frame.remove();
  frames.clear();
});

describe("real-browser deployment diagnostics", () => {
  it("scans actual HTTP responses and verifies the published manifest resource graph", async () => {
    const manifestURL = new URL("/resource-manifest.json", location.origin).href;
    const manifestResponse = await fetch(manifestURL);
    const manifestBytes = await manifestResponse.arrayBuffer();
    const manifestIntegrity = `sha384-${base64(await crypto.subtle.digest("SHA-384", manifestBytes))}`;
    const entryIntegrity = "sha384-DTUJc9mnoMYWbvM91U22wwbhC6oeEmOMZfzmQ9CfLzstiiynKYLSy3A23iiJhymN";
    const result = await scanDeployment({
      hostUrl: location.href,
      execution: "browser",
      csp: "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; report-uri /csp-report",
      applications: [{
        name: "resource-browser-contract",
        entry: "/resource-entry.js",
        type: "module",
        integrity: entryIntegrity,
        manifest: { url: manifestURL, integrity: manifestIntegrity },
      }],
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources.filter(({ integrityVerified }) => integrityVerified)).toHaveLength(4);
    expect(result.resources.map(({ kind }) => kind)).toEqual(expect.arrayContaining([
      "host",
      "manifest",
      "script",
      "style",
    ]));
  });

  it("collects a genuine CSP violation from an isolated browser Realm", async () => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    document.body.append(frame);
    frames.add(frame);
    const realmWindow = frame.contentWindow as (Window & typeof globalThis) | null;
    const realmDocument = frame.contentDocument;
    if (!realmWindow || !realmDocument) throw new Error("Unable to create diagnostics Realm.");

    let resolveReport!: (report: BrowserPolicyReport) => void;
    const reportPromise = new Promise<BrowserPolicyReport>((resolve, reject) => {
      resolveReport = resolve;
      window.setTimeout(() => reject(new Error("CSP violation report timed out.")), 3_000);
    });
    const collector = installBrowserReportCollector(realmWindow, {
      types: ["csp-violation"],
      onReport: resolveReport,
    });
    const policy = realmDocument.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "script-src 'none'";
    realmDocument.head.append(policy);
    const blockedScript = realmDocument.createElement("script");
    blockedScript.textContent = "window.__microFrameBlockedScriptExecuted = true";
    realmDocument.body.append(blockedScript);

    const report = await reportPromise;
    expect(Reflect.get(realmWindow, "__microFrameBlockedScriptExecuted")).toBeUndefined();
    expect(report).toMatchObject({
      type: "csp-violation",
    });
    expect(["securitypolicyviolation", "reporting-observer"]).toContain(report.source);
    expect(report.directive).toMatch(/script-src/);
    expect(collector.snapshot()).toHaveLength(1);
    collector.destroy();
    expect(collector.snapshot()).toEqual([]);
  });
});

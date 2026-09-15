import { cspAllowsResource, type CspResourceType } from "./csp-policy";
import { verifySubresourceIntegrity } from "./integrity";
import { addDiagnostic, type ResourceResult, type ScanContext } from "./scan-context";
import type { DeploymentResourceKind, ScannedDeploymentResource } from "./types";

function acceptsContentType(kind: DeploymentResourceKind, value: string): boolean {
  const contentType = value.toLowerCase();
  switch (kind) {
    case "host": return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    case "manifest": return contentType.includes("application/json") || contentType.includes("+json");
    case "script": return /(?:java|ecma)script|text\/jsx|application\/wasm/.test(contentType);
    case "style": return contentType.includes("text/css");
    case "entry": return acceptsContentType("host", value) || acceptsContentType("script", value);
    case "asset": return true;
  }
}

function resourceDirective(kind: DeploymentResourceKind): CspResourceType | undefined {
  if (kind === "entry" || kind === "script") return "script";
  if (kind === "style") return "style";
  return undefined;
}

function inspectCsp(
  context: ScanContext,
  kind: DeploymentResourceKind,
  url: string,
  application?: string,
  requiresConnect = false,
): void {
  if (!context.policy) return;
  const directive = resourceDirective(kind);
  if (directive && !cspAllowsResource(context.policy, directive, url, context.hostURL.href)) {
    const code = directive === "script" ? "csp-blocked-script" : "csp-blocked-style";
    addDiagnostic(
      context,
      code,
      "error",
      `The enforced CSP does not allow ${url} through ${directive}-src.`,
      `Add the resource origin to ${directive}-src (or its element-specific directive) without enabling unsafe-eval.`,
      application,
      url,
    );
  }
  if (requiresConnect && !cspAllowsResource(context.policy, "connect", url, context.hostURL.href)) {
    addDiagnostic(
      context,
      "csp-blocked-connect",
      "error",
      `The enforced CSP does not allow Runtime fetch/prefetch access to ${url}.`,
      "Add the resource origin to connect-src or disable the fetch-based feature that consumes it.",
      application,
      url,
    );
  }
}

function inspectCors(
  context: ScanContext,
  response: Response,
  requestedURL: string,
  application?: string,
): void {
  const actualURL = new URL(response.url || requestedURL, requestedURL);
  if (actualURL.origin === context.hostURL.origin || context.options.execution === "browser") return;
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  if (!allowedOrigin) {
    addDiagnostic(
      context,
      "cors-missing",
      "error",
      `Cross-origin resource ${actualURL.href} does not return Access-Control-Allow-Origin.`,
      `Return Access-Control-Allow-Origin: ${context.hostURL.origin} (or * for non-credentialed public assets).`,
      application,
      actualURL.href,
    );
    return;
  }
  if (allowedOrigin !== "*" && allowedOrigin !== context.hostURL.origin) {
    addDiagnostic(
      context,
      "cors-origin-mismatch",
      "error",
      `Cross-origin resource ${actualURL.href} allows ${allowedOrigin}, not ${context.hostURL.origin}.`,
      `Return Access-Control-Allow-Origin: ${context.hostURL.origin}.`,
      application,
      actualURL.href,
    );
  } else if (allowedOrigin !== "*"
    && !response.headers.get("vary")?.toLowerCase().split(/\s*,\s*/).includes("origin")) {
    addDiagnostic(
      context,
      "cors-vary-origin-missing",
      "warning",
      `Cross-origin resource ${actualURL.href} reflects a specific origin without Vary: Origin.`,
      "Add Vary: Origin so shared caches cannot serve a response authorized for another host.",
      application,
      actualURL.href,
    );
  }
}

async function fetchWithTimeout(
  context: ScanContext,
  url: string,
  accept: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException(`Timed out while fetching ${url}.`, "TimeoutError")),
    context.options.requestTimeoutMs,
  );
  try {
    const headers: Record<string, string> = { Accept: accept };
    if (context.options.execution === "server") headers.Origin = context.hostURL.origin;
    return await context.fetcher(url, {
      cache: "no-store",
      headers,
      mode: "cors",
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function scanResource(
  context: ScanContext,
  kind: DeploymentResourceKind,
  url: string,
  application?: string,
  integrity?: string,
  requiresConnect = false,
): Promise<ResourceResult> {
  inspectCsp(context, kind, url, application, requiresConnect);
  const started = performance.now();
  let response: Response;
  try {
    response = await fetchWithTimeout(
      context,
      url,
      kind === "manifest" ? "application/json" : kind === "host" ? "text/html" : "*/*",
    );
  } catch (error) {
    addDiagnostic(
      context,
      kind === "host" ? "host-fetch" : "resource-fetch",
      "error",
      `Unable to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
      "Check DNS, TLS, CSP, CORS, proxy configuration and network reachability.",
      application,
      url,
    );
    context.resources.push({ application, kind, url, integrity, durationMs: performance.now() - started });
    return {};
  }

  const contentType = response.headers.get("content-type") ?? "";
  const resource: ScannedDeploymentResource = {
    application,
    kind,
    url: response.url || url,
    status: response.status,
    contentType: contentType || undefined,
    integrity,
    durationMs: performance.now() - started,
  };
  if (!response.ok) {
    addDiagnostic(
      context,
      "resource-http",
      "error",
      `Resource ${url} returned ${response.status} ${response.statusText}.`,
      "Publish the resource at the manifest URL or update the deployment descriptor.",
      application,
      url,
    );
    context.resources.push(resource);
    return { contentType, responseURL: response.url || url, headers: response.headers };
  }
  inspectCors(context, response, url, application);
  if (!acceptsContentType(kind, contentType)) {
    addDiagnostic(
      context,
      "content-type-invalid",
      "error",
      `Resource ${url} returned incompatible Content-Type ${contentType || "<missing>"}.`,
      kind === "script" || kind === "entry"
        ? "Serve ESM with a JavaScript MIME type and HTML entries with text/html."
        : `Serve this ${kind} with its standard MIME type.`,
      application,
      url,
    );
  }
  let bytes: ArrayBuffer;
  try { bytes = await response.arrayBuffer(); }
  catch (error) {
    addDiagnostic(
      context,
      "resource-fetch",
      "error",
      `Unable to read ${url}: ${error instanceof Error ? error.message : String(error)}`,
      "Check response streaming, content encoding and proxy truncation.",
      application,
      url,
    );
    context.resources.push(resource);
    return { contentType, responseURL: response.url || url, headers: response.headers };
  }

  let integrityVerified: boolean | undefined;
  if (!integrity && context.options.requireIntegrity && kind !== "host") {
    addDiagnostic(
      context,
      "integrity-missing",
      "error",
      `Resource ${url} has no integrity metadata.`,
      "Generate the schema v2 manifest and publish SHA-384 metadata for every entry, chunk and asset.",
      application,
      url,
    );
  } else if (integrity) {
    const verification = await verifySubresourceIntegrity(context.cryptography, bytes, integrity);
    integrityVerified = verification.status === "verified";
    if (verification.status === "invalid") {
      addDiagnostic(
        context,
        "integrity-invalid",
        "error",
        `Resource ${url} has invalid or unsupported SRI metadata.`,
        "Use sha256, sha384 or sha512 SRI syntax; SHA-384 is the framework default.",
        application,
        url,
      );
    } else if (verification.status === "mismatch") {
      addDiagnostic(
        context,
        "integrity-mismatch",
        "error",
        `Resource ${url} does not match its ${verification.algorithm} integrity digest.`,
        "Stop the release, rebuild the manifest from the exact published bytes, and investigate CDN mutation.",
        application,
        url,
      );
    }
  }
  context.resources.push({ ...resource, integrityVerified });
  return { bytes, contentType, responseURL: response.url || url, headers: response.headers };
}

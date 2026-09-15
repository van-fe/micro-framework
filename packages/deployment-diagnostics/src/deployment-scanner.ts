import {
  cspAllowsUnsafeEval,
  cspHasReporting,
  parseCspPolicy,
} from "./csp-policy";
import { runConcurrently, scanApplication } from "./manifest-scan";
import { scanResource } from "./resource-scan";
import { addDiagnostic, type ScanContext } from "./scan-context";
import type {
  DeploymentDiagnostic,
  DeploymentScanOptions,
  DeploymentScanResult,
} from "./types";

function deduplicateDiagnostics(diagnostics: readonly DeploymentDiagnostic[]): DeploymentDiagnostic[] {
  const unique = new Map<string, DeploymentDiagnostic>();
  for (const item of diagnostics) {
    unique.set(JSON.stringify([item.application, item.code, item.url, item.message]), item);
  }
  return [...unique.values()].sort((left, right) =>
    (left.application ?? "").localeCompare(right.application ?? "")
      || left.code.localeCompare(right.code)
      || (left.url ?? "").localeCompare(right.url ?? ""),
  );
}

export async function scanDeployment(options: DeploymentScanOptions): Promise<DeploymentScanResult> {
  const hostURL = new URL(options.hostUrl);
  const context: ScanContext = {
    options: {
      execution: options.execution ?? "server",
      requireIntegrity: options.requireIntegrity ?? true,
      requestTimeoutMs: Math.max(1, options.requestTimeoutMs ?? 15_000),
      concurrency: Math.max(1, options.concurrency ?? 6),
    },
    fetcher: options.fetch ?? globalThis.fetch.bind(globalThis),
    cryptography: options.crypto ?? globalThis.crypto,
    hostURL,
    diagnostics: [],
    resources: [],
  };

  const host = await scanResource(context, "host", hostURL.href);
  const csp = options.csp ?? host.headers?.get("content-security-policy") ?? undefined;
  if (!csp) {
    addDiagnostic(
      context,
      "csp-missing",
      "warning",
      "The host response has no enforced Content-Security-Policy.",
      "Add a strict CSP that allows only the host and declared application resource origins.",
    );
  } else {
    context.policy = parseCspPolicy(csp);
    if (cspAllowsUnsafeEval(context.policy)) {
      addDiagnostic(
        context,
        "csp-unsafe-eval",
        "warning",
        "The host CSP enables 'unsafe-eval', which Micro Frame does not require.",
        "Remove 'unsafe-eval' and keep application entries as native external ESM.",
      );
    }
    if (!cspHasReporting(context.policy)) {
      addDiagnostic(
        context,
        "csp-reporting-missing",
        "warning",
        "The host CSP has no report-to or report-uri endpoint.",
        "Configure CSP reporting and install the browser report collector for client-side triage.",
      );
    }
  }

  await runConcurrently(options.applications, context.options.concurrency, async (application) => {
    await scanApplication(context, application);
  });
  const diagnostics = deduplicateDiagnostics(context.diagnostics);
  const resources = [...context.resources].sort((left, right) =>
    (left.application ?? "").localeCompare(right.application ?? "")
      || left.kind.localeCompare(right.kind)
      || left.url.localeCompare(right.url),
  );
  return {
    ok: !diagnostics.some(({ severity }) => severity === "error"),
    scannedAt: new Date().toISOString(),
    hostUrl: hostURL.href,
    contentSecurityPolicy: csp,
    diagnostics,
    resources,
  };
}

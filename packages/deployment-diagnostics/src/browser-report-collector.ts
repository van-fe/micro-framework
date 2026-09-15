import type {
  BrowserPolicyReport,
  BrowserPolicyReportType,
  BrowserReportCollector,
  BrowserReportCollectorOptions,
} from "./types";

interface ReportingApiReport {
  readonly type: string;
  readonly url?: string;
  readonly body?: unknown;
}

interface ReportingObserverLike {
  observe(): void;
  disconnect(): void;
}

interface ReportingObserverConstructor {
  new(
    callback: (reports: readonly ReportingApiReport[]) => void,
    options?: { buffered?: boolean; types?: readonly string[] },
  ): ReportingObserverLike;
}

function normalizeType(type: string): BrowserPolicyReportType {
  switch (type) {
    case "csp-violation":
    case "permissions-policy-violation":
    case "deprecation":
    case "intervention":
    case "crash":
      return type;
    default:
      return "other";
  }
}

function reportBody(body: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const serializable = body as { toJSON?(): unknown };
  const value = typeof serializable.toJSON === "function" ? serializable.toJSON() : body;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

function fingerprint(report: BrowserPolicyReport): string {
  const policyIdentity = report.directive || report.blockedURL
    ? undefined
    : [report.message, report.body];
  return JSON.stringify([
    report.type,
    report.url,
    report.directive,
    report.blockedURL,
    report.lineNumber,
    report.columnNumber,
    policyIdentity,
  ]);
}

export function installBrowserReportCollector(
  hostWindow: Window & typeof globalThis,
  options: BrowserReportCollectorOptions = {},
): BrowserReportCollector {
  const maximum = Math.max(1, options.maxReports ?? 100);
  const allowedTypes = new Set<BrowserPolicyReportType>(options.types ?? [
    "csp-violation",
    "permissions-policy-violation",
    "deprecation",
    "intervention",
    "crash",
    "other",
  ]);
  const reports: BrowserPolicyReport[] = [];
  const fingerprints = new Set<string>();
  let destroyed = false;

  const publish = (input: BrowserPolicyReport) => {
    if (destroyed || !allowedTypes.has(input.type)) return;
    const report = Object.freeze(input);
    const key = fingerprint(report);
    if (fingerprints.has(key)) return;
    reports.push(report);
    fingerprints.add(key);
    while (reports.length > maximum) {
      const removed = reports.shift();
      if (removed) fingerprints.delete(fingerprint(removed));
    }
    try { options.onReport?.(report); }
    catch (error) { hostWindow.console.error("Browser report collector callback failed.", error); }
  };

  const onSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => publish({
    type: "csp-violation",
    source: "securitypolicyviolation",
    timestamp: Date.now(),
    url: event.documentURI,
    message: event.sample || undefined,
    directive: event.effectiveDirective || event.violatedDirective || undefined,
    blockedURL: event.blockedURI || undefined,
    lineNumber: event.lineNumber || undefined,
    columnNumber: event.columnNumber || undefined,
    body: Object.freeze({
      disposition: event.disposition,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      statusCode: event.statusCode,
    }),
  });
  hostWindow.addEventListener("securitypolicyviolation", onSecurityPolicyViolation);

  const ReportingObserver = Reflect.get(hostWindow, "ReportingObserver") as
    | ReportingObserverConstructor
    | undefined;
  let observer: ReportingObserverLike | undefined;
  if (ReportingObserver) {
    try {
      observer = new ReportingObserver((entries) => {
        for (const entry of entries) {
          const body = reportBody(entry.body);
          publish({
            type: normalizeType(entry.type),
            source: "reporting-observer",
            timestamp: Date.now(),
            url: entry.url,
            message: typeof body?.message === "string" ? body.message : undefined,
            directive: typeof body?.effectiveDirective === "string"
              ? body.effectiveDirective
              : undefined,
            blockedURL: typeof body?.blockedURL === "string" ? body.blockedURL : undefined,
            lineNumber: typeof body?.lineNumber === "number" ? body.lineNumber : undefined,
            columnNumber: typeof body?.columnNumber === "number" ? body.columnNumber : undefined,
            body,
          });
        }
      }, {
        buffered: options.buffered ?? true,
        types: [...allowedTypes].filter((type) => type !== "other"),
      });
      observer.observe();
    }
    catch (error) {
      hostWindow.console.warn("ReportingObserver could not be started.", error);
      observer = undefined;
    }
  }

  return {
    snapshot: () => Object.freeze([...reports]),
    clear() {
      reports.length = 0;
      fingerprints.clear();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hostWindow.removeEventListener("securitypolicyviolation", onSecurityPolicyViolation);
      observer?.disconnect();
      reports.length = 0;
      fingerprints.clear();
    },
  };
}

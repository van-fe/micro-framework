export type DeploymentDiagnosticSeverity = "error" | "warning" | "info";

export type DeploymentDiagnosticCode =
  | "host-fetch"
  | "resource-fetch"
  | "resource-http"
  | "cors-missing"
  | "cors-origin-mismatch"
  | "cors-vary-origin-missing"
  | "content-type-invalid"
  | "manifest-invalid"
  | "integrity-missing"
  | "integrity-invalid"
  | "integrity-mismatch"
  | "csp-missing"
  | "csp-unsafe-eval"
  | "csp-reporting-missing"
  | "csp-blocked-connect"
  | "csp-blocked-script"
  | "csp-blocked-style";

export interface DeploymentDiagnostic {
  readonly code: DeploymentDiagnosticCode;
  readonly severity: DeploymentDiagnosticSeverity;
  readonly message: string;
  readonly recommendation: string;
  readonly application?: string;
  readonly url?: string;
}

export interface DeploymentApplicationTarget {
  readonly name: string;
  readonly entry: string;
  readonly type?: "auto" | "html" | "module";
  readonly integrity?: string;
  readonly manifest?: {
    readonly url: string;
    readonly integrity?: string;
  };
}

export interface DeploymentScanOptions {
  readonly hostUrl: string;
  readonly applications: readonly DeploymentApplicationTarget[];
  readonly fetch?: typeof fetch;
  readonly crypto?: Crypto;
  readonly csp?: string;
  readonly execution?: "server" | "browser";
  readonly requireIntegrity?: boolean;
  readonly requestTimeoutMs?: number;
  readonly concurrency?: number;
}

export type DeploymentResourceKind = "host" | "entry" | "manifest" | "script" | "style" | "asset";

export interface ScannedDeploymentResource {
  readonly application?: string;
  readonly kind: DeploymentResourceKind;
  readonly url: string;
  readonly status?: number;
  readonly contentType?: string;
  readonly integrity?: string;
  readonly integrityVerified?: boolean;
  readonly durationMs: number;
}

export interface DeploymentScanResult {
  readonly ok: boolean;
  readonly scannedAt: string;
  readonly hostUrl: string;
  readonly contentSecurityPolicy?: string;
  readonly diagnostics: readonly DeploymentDiagnostic[];
  readonly resources: readonly ScannedDeploymentResource[];
}

export type BrowserPolicyReportType =
  | "csp-violation"
  | "permissions-policy-violation"
  | "deprecation"
  | "intervention"
  | "crash"
  | "other";

export interface BrowserPolicyReport {
  readonly type: BrowserPolicyReportType;
  readonly source: "securitypolicyviolation" | "reporting-observer";
  readonly timestamp: number;
  readonly url?: string;
  readonly message?: string;
  readonly directive?: string;
  readonly blockedURL?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly body?: Readonly<Record<string, unknown>>;
}

export interface BrowserReportCollectorOptions {
  readonly maxReports?: number;
  readonly buffered?: boolean;
  readonly types?: readonly BrowserPolicyReportType[];
  readonly onReport?: (report: BrowserPolicyReport) => void;
}

export interface BrowserReportCollector {
  snapshot(): readonly BrowserPolicyReport[];
  clear(): void;
  destroy(): void;
}

export interface CorsConfigurationOptions {
  /** Host pages that are allowed to load micro-application resources. */
  readonly hostOrigins: readonly string[];
  /** Resource origins this plan will be deployed to; retained as auditable metadata. */
  readonly resourceOrigins?: readonly string[];
  readonly allowCredentials?: boolean;
  readonly methods?: readonly string[];
  readonly allowedHeaders?: readonly string[];
  readonly exposedHeaders?: readonly string[];
  readonly maxAgeSeconds?: number;
}

export interface CorsServerConfiguration {
  readonly origin: readonly string[];
  readonly methods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly exposedHeaders: readonly string[];
  readonly credentials: boolean;
  readonly maxAge: number;
}

export interface CorsConfigurationPlan {
  readonly mode: "static-origin" | "validated-origin-echo";
  readonly allowedOrigins: readonly string[];
  readonly resourceOrigins: readonly string[];
  readonly responseHeaders: Readonly<Record<string, string>>;
  readonly viteServerCors: CorsServerConfiguration;
  readonly nginx: string;
  readonly checks: readonly string[];
}

import type { ParsedCspPolicy } from "./csp-policy";
import type {
  DeploymentDiagnostic,
  DeploymentDiagnosticCode,
  DeploymentScanOptions,
  ScannedDeploymentResource,
} from "./types";

export interface ResourceResult {
  readonly bytes?: ArrayBuffer;
  readonly contentType?: string;
  readonly responseURL?: string;
  readonly headers?: Headers;
}

export interface ScanContext {
  readonly options: Required<Pick<
    DeploymentScanOptions,
    "execution" | "requireIntegrity" | "requestTimeoutMs" | "concurrency"
  >>;
  readonly fetcher: typeof fetch;
  readonly cryptography: Crypto;
  readonly hostURL: URL;
  readonly diagnostics: DeploymentDiagnostic[];
  readonly resources: ScannedDeploymentResource[];
  policy?: ParsedCspPolicy;
}

export function addDiagnostic(
  context: ScanContext,
  code: DeploymentDiagnosticCode,
  severity: DeploymentDiagnostic["severity"],
  message: string,
  recommendation: string,
  application?: string,
  url?: string,
): void {
  context.diagnostics.push({ code, severity, message, recommendation, application, url });
}

export type DomGuardDiagnosticCode =
  | "host-window-access"
  | "dom-escape"
  | "service-worker-blocked";

export interface DomGuardDiagnostic {
  readonly code: DomGuardDiagnosticCode;
  readonly applicationName: string;
  readonly access: string;
  readonly message: string;
  readonly blocked: boolean;
}

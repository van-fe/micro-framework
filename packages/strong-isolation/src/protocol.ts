export const strongIsolationProtocol = "micro-frame:strong-isolation:v1" as const;

export type StrongIsolationPhase =
  | "bootstrap"
  | "mount"
  | "activate"
  | "deactivate"
  | "update"
  | "unmount"
  | "dispose";

export interface StrongIsolationInitMessage {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "init";
  readonly nonce: string;
  readonly name: string;
  readonly instanceId: string;
}

export interface StrongIsolationReadyMessage {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "ready";
  readonly nonce: string;
}

export interface StrongIsolationRequestMessage {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "request";
  readonly requestId: string;
  readonly phase: StrongIsolationPhase;
  readonly props: Record<string, unknown>;
}

export type StrongIsolationResponseMessage = {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "response";
  readonly requestId: string;
  readonly ok: true;
} | {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "response";
  readonly requestId: string;
  readonly ok: false;
  readonly error: { readonly name: string; readonly message: string; readonly stack?: string };
};

export interface StrongIsolationErrorMessage {
  readonly protocol: typeof strongIsolationProtocol;
  readonly type: "runtime-error";
  readonly kind: "error" | "unhandledrejection";
  readonly error: { readonly name: string; readonly message: string; readonly stack?: string };
}

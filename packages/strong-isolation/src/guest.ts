import type { MaybePromise } from "@micro-framework/contracts";
import {
  strongIsolationProtocol,
  type StrongIsolationInitMessage,
  type StrongIsolationPhase,
  type StrongIsolationRequestMessage,
  type StrongIsolationResponseMessage,
} from "./protocol";

export type StrongIsolationGuestProps<Props extends object = Record<string, unknown>> = Props & {
  readonly name: string;
  readonly container: HTMLElement;
  readonly overlayContainer: HTMLElement;
  readonly $isolation: Readonly<{
    instanceId: string;
    signal: AbortSignal;
  }>;
};

export type StrongIsolationGuestLifecycleFunction<Props extends object = Record<string, unknown>> = (
  props: StrongIsolationGuestProps<Props>,
) => MaybePromise<void>;

export type StrongIsolationGuestLifecycleValue<Props extends object = Record<string, unknown>> =
  | StrongIsolationGuestLifecycleFunction<Props>
  | readonly StrongIsolationGuestLifecycleFunction<Props>[];

export interface StrongIsolationGuestLifecycle<Props extends object = Record<string, unknown>> {
  bootstrap?: StrongIsolationGuestLifecycleValue<Props>;
  mount: StrongIsolationGuestLifecycleValue<Props>;
  activate?: StrongIsolationGuestLifecycleValue<Props>;
  deactivate?: StrongIsolationGuestLifecycleValue<Props>;
  update?: StrongIsolationGuestLifecycleValue<Props>;
  unmount: StrongIsolationGuestLifecycleValue<Props>;
  dispose?: StrongIsolationGuestLifecycleValue<Props>;
}

export interface StrongIsolationGuestOptions {
  readonly allowedParentOrigins?: readonly string[];
}

export interface StrongIsolationGuestInstallation {
  destroy(): void;
}

function operations<Props extends object>(
  value: StrongIsolationGuestLifecycleValue<Props> | undefined,
): readonly StrongIsolationGuestLifecycleFunction<Props>[] {
  if (!value) return [];
  return Array.isArray(value)
    ? value as readonly StrongIsolationGuestLifecycleFunction<Props>[]
    : [value as StrongIsolationGuestLifecycleFunction<Props>];
}

export function installStrongIsolationGuest<Props extends object = Record<string, unknown>>(
  lifecycle: StrongIsolationGuestLifecycle<Props>,
  options: StrongIsolationGuestOptions = {},
): StrongIsolationGuestInstallation {
  const allowedOrigins = options.allowedParentOrigins
    ? new Set(options.allowedParentOrigins.map((origin) => new URL(origin, window.location.href).origin))
    : undefined;
  let port: MessagePort | undefined;
  let abortController: AbortController | undefined;
  let destroyed = false;
  let queue = Promise.resolve();

  const report = (error: unknown, kind: "error" | "unhandledrejection") => {
    if (destroyed || !port) return;
    port.postMessage({ protocol: strongIsolationProtocol, type: "runtime-error", kind, error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    } });
  };
  const onError = (event: ErrorEvent) => report(event.error ?? event.message, "error");
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason, "unhandledrejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  const onInit = (event: MessageEvent<StrongIsolationInitMessage>) => {
    const init = event.data;
    if (destroyed || port || event.source !== window.parent) return;
    if (allowedOrigins && !allowedOrigins.has(event.origin)) return;
    if (init?.protocol !== strongIsolationProtocol || init.type !== "init") return;
    const transferredPort = event.ports[0];
    if (!transferredPort) return;
    port = transferredPort;
    abortController = new AbortController();
    transferredPort.addEventListener("message", (messageEvent: MessageEvent<StrongIsolationRequestMessage>) => {
      const request = messageEvent.data;
      if (request?.protocol !== strongIsolationProtocol || request.type !== "request") return;
      queue = queue.then(async () => {
        let response: StrongIsolationResponseMessage;
        try {
          const context = Object.assign({}, request.props, {
            name: init.name,
            container: document.body,
            overlayContainer: document.body,
            $isolation: Object.freeze({
              instanceId: init.instanceId,
              signal: abortController!.signal,
            }),
          }) as StrongIsolationGuestProps<Props>;
          const phase = request.phase satisfies StrongIsolationPhase;
          for (const operation of operations(lifecycle[phase])) await operation(context);
          response = {
            protocol: strongIsolationProtocol,
            type: "response",
            requestId: request.requestId,
            ok: true,
          };
        } catch (error) {
          response = {
            protocol: strongIsolationProtocol,
            type: "response",
            requestId: request.requestId,
            ok: false,
            error: {
              name: error instanceof Error ? error.name : "Error",
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          };
        }
        transferredPort.postMessage(response);
        if (request.phase === "dispose") abortController?.abort();
      });
    });
    transferredPort.start();
    transferredPort.postMessage({
      protocol: strongIsolationProtocol,
      type: "ready",
      nonce: init.nonce,
    });
  };

  window.addEventListener("message", onInit);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("message", onInit);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      abortController?.abort();
      port?.close();
      port = undefined;
    },
  };
}

import type {
  AppEntry,
  AppLifecycle,
  AppProps,
  StrongIsolationOptions,
} from "@micro-framework/contracts";
import {
  strongIsolationProtocol,
  type StrongIsolationErrorMessage,
  type StrongIsolationInitMessage,
  type StrongIsolationPhase,
  type StrongIsolationReadyMessage,
  type StrongIsolationRequestMessage,
  type StrongIsolationResponseMessage,
} from "./protocol";

const forbiddenSandboxTokens = new Set([
  "allow-same-origin",
  "allow-storage-access-by-user-activation",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-popups-to-escape-sandbox",
]);

export function normalizeStrongIsolationSandbox(value = "allow-scripts"): string {
  const tokens = [...new Set(value.split(/\s+/).filter(Boolean))].sort();
  if (!tokens.includes("allow-scripts")) {
    throw new TypeError("Strong isolation sandbox must include allow-scripts.");
  }
  const forbidden = tokens.find((token) => forbiddenSandboxTokens.has(token));
  if (forbidden) throw new TypeError(`Strong isolation sandbox token is forbidden: ${forbidden}`);
  return tokens.join(" ");
}

export function resolveStrongIsolationEntryUrl(
  entry: AppEntry,
  baseUrl: string,
  hostOrigin: string,
): string {
  const descriptor = typeof entry === "string" ? { url: entry, type: "auto" as const } : entry;
  if (descriptor.type === "module") {
    throw new TypeError("Strong isolation requires an HTML document entry, not a module entry.");
  }
  const url = new URL(descriptor.url, baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`Strong isolation entry must use HTTP(S): ${url.href}`);
  }
  if (url.origin === hostOrigin) {
    throw new TypeError(`Strong isolation entry must be cross-origin: ${url.href}`);
  }
  return url.href;
}

export interface StrongIsolationFrameHostOptions {
  readonly name: string;
  readonly instanceId: string;
  readonly isolation: StrongIsolationOptions;
  readonly loadTimeout?: number;
  readonly onError?: (error: unknown, kind: "error" | "unhandledrejection") => void;
}

interface PendingCommand {
  resolve(): void;
  reject(error: unknown): void;
}

function businessProps<Props extends object>(props: AppProps<Props>): Record<string, unknown> {
  const source = props as AppProps<Props> & Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "name" || key === "container" || key === "overlayContainer" || key === "$runtime") continue;
    result[key] = value;
  }
  return result;
}

export class StrongIsolationFrameHost<Props extends object = Record<string, unknown>> {
  readonly #container: HTMLElement;
  readonly #options: StrongIsolationFrameHostOptions;
  readonly #pending = new Map<string, PendingCommand>();
  #iframe?: HTMLIFrameElement;
  #port?: MessagePort;
  #lifecycle?: AppLifecycle<Props>;
  #active = true;
  #destroyed = false;
  #requestSequence = 0;
  readonly #loadController = new AbortController();

  constructor(container: HTMLElement, options: StrongIsolationFrameHostOptions) {
    this.#container = container;
    this.#options = options;
  }

  get iframe(): HTMLIFrameElement | undefined { return this.#iframe; }

  async load(entry: AppEntry, signal: AbortSignal = this.#loadController.signal): Promise<AppLifecycle<Props>> {
    signal.throwIfAborted();
    if (this.#lifecycle) return this.#lifecycle;
    if (this.#destroyed) throw new Error("Strong isolation frame is destroyed.");
    const hostDocument = this.#container.ownerDocument;
    const hostWindow = hostDocument.defaultView;
    if (!hostWindow) throw new Error("Strong isolation container is detached from its Window.");
    const source = resolveStrongIsolationEntryUrl(entry, hostDocument.baseURI, hostWindow.location.origin);
    const frame = hostDocument.createElement("iframe");
    frame.dataset.microFrameStrongIsolation = this.#options.name;
    frame.title = this.#options.isolation.title ?? `Strongly isolated application ${this.#options.name}`;
    frame.setAttribute("sandbox", normalizeStrongIsolationSandbox(this.#options.isolation.sandbox));
    if (this.#options.isolation.allow) frame.setAttribute("allow", this.#options.isolation.allow);
    frame.referrerPolicy = this.#options.isolation.referrerPolicy ?? "no-referrer";
    frame.style.border = "0";
    frame.style.display = this.#active ? "block" : "none";
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.inert = !this.#active;
    frame.hidden = !this.#active;
    this.#iframe = frame;

    await new Promise<void>((resolve, reject) => {
      const timeoutMs = this.#options.loadTimeout ?? 15_000;
      const timeout = timeoutMs > 0 ? hostWindow.setTimeout(
        () => { cleanup(); reject(new Error(`Strong isolation document load timed out: ${source}`)); }, timeoutMs,
      ) : undefined;
      const cleanup = () => {
        if (timeout !== undefined) hostWindow.clearTimeout(timeout);
        signal.removeEventListener("abort", aborted);
        this.#loadController.signal.removeEventListener("abort", aborted);
        frame.removeEventListener("load", loaded);
        frame.removeEventListener("error", failed);
      };
      const aborted = () => { cleanup(); reject(signal.reason ?? this.#loadController.signal.reason); };
      signal.addEventListener("abort", aborted, { once: true });
      this.#loadController.signal.addEventListener("abort", aborted, { once: true });
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error(`Unable to load strong isolation document: ${source}`)); };
      frame.addEventListener("load", loaded, { once: true });
      frame.addEventListener("error", failed, { once: true });
      frame.src = source;
      this.#container.append(frame);
    });

    signal.throwIfAborted();
    if (this.#destroyed) throw new Error("Strong isolation frame is destroyed.");
    await this.#connect(hostWindow, signal);
    const command = (phase: StrongIsolationPhase, props: AppProps<Props>) =>
      this.#command(phase, businessProps(props));
    this.#lifecycle = {
      bootstrap: (props) => command("bootstrap", props),
      mount: (props) => command("mount", props),
      activate: (props) => command("activate", props),
      deactivate: (props) => command("deactivate", props),
      update: (props) => command("update", props),
      unmount: (props) => command("unmount", props),
      dispose: (props) => command("dispose", props),
    };
    return this.#lifecycle;
  }

  setActive(active: boolean): void {
    this.#active = active;
    if (!this.#iframe) return;
    this.#iframe.hidden = !active;
    this.#iframe.inert = !active;
    this.#iframe.style.display = active ? "block" : "none";
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#loadController.abort();
    const error = new Error(`Strong isolation frame was destroyed: ${this.#options.name}`);
    for (const command of this.#pending.values()) command.reject(error);
    this.#pending.clear();
    this.#port?.close();
    this.#port = undefined;
    this.#lifecycle = undefined;
    this.#iframe?.remove();
    this.#iframe = undefined;
  }

  async #connect(hostWindow: Window & typeof globalThis, signal: AbortSignal): Promise<void> {
    const target = this.#iframe?.contentWindow;
    if (!target) throw new Error("Strong isolation iframe has no content Window.");
    const channel = new hostWindow.MessageChannel();
    const nonce = crypto.randomUUID();
    this.#port = channel.port1;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        if (timeout !== undefined) hostWindow.clearTimeout(timeout);
        signal.removeEventListener("abort", aborted);
        this.#loadController.signal.removeEventListener("abort", aborted);
        channel.port1.removeEventListener("message", ready);
      };
      const aborted = () => { cleanup(); channel.port1.close(); reject(signal.reason ?? this.#loadController.signal.reason); };
      const timeoutMs = this.#options.loadTimeout ?? 15_000;
      const timeout = timeoutMs > 0 ? hostWindow.setTimeout(() => {
        cleanup(); channel.port1.close();
        reject(new Error(`Strong isolation guest handshake timed out: ${this.#options.name}`));
      }, timeoutMs) : undefined;
      const ready = (event: MessageEvent<StrongIsolationReadyMessage>) => {
        const message = event.data;
        if (message?.protocol !== strongIsolationProtocol || message.type !== "ready" || message.nonce !== nonce) return;
        cleanup(); resolve();
      };
      signal.addEventListener("abort", aborted, { once: true });
      this.#loadController.signal.addEventListener("abort", aborted, { once: true });
      channel.port1.addEventListener("message", ready);
      channel.port1.start();
      const init: StrongIsolationInitMessage = {
        protocol: strongIsolationProtocol,
        type: "init",
        nonce,
        name: this.#options.name,
        instanceId: this.#options.instanceId,
      };
      target.postMessage(init, "*", [channel.port2]);
    });
    channel.port1.addEventListener("message", (event: MessageEvent<StrongIsolationResponseMessage | StrongIsolationErrorMessage>) => {
      const response = event.data;
      if (response?.protocol !== strongIsolationProtocol || this.#destroyed) return;
      if (response.type === "runtime-error") {
        if (!["error", "unhandledrejection"].includes(response.kind) || typeof response.error?.message !== "string") return;
        try { this.#options.onError?.(Object.assign(new Error(response.error.message), response.error), response.kind); }
        catch { /* Observer failure must not disrupt lifecycle transport. */ }
        return;
      }
      if (response.type !== "response") return;
      const pending = this.#pending.get(response.requestId);
      if (!pending) return;
      this.#pending.delete(response.requestId);
      if (response.ok) pending.resolve();
      else pending.reject(Object.assign(new Error(response.error.message), {
        name: response.error.name,
        stack: response.error.stack,
      }));
    });
  }

  #command(phase: StrongIsolationPhase, props: Record<string, unknown>): Promise<void> {
    if (this.#destroyed || !this.#port) {
      return Promise.reject(new Error(`Strong isolation guest is unavailable: ${this.#options.name}`));
    }
    const requestId = `${this.#options.instanceId}:${++this.#requestSequence}`;
    const request: StrongIsolationRequestMessage = {
      protocol: strongIsolationProtocol,
      type: "request",
      requestId,
      phase,
      props,
    };
    return new Promise<void>((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      try { this.#port!.postMessage(request); }
      catch (error) {
        this.#pending.delete(requestId);
        reject(error);
      }
    });
  }
}

import type { AppLifecycle } from "@micro-framework/contracts";
import { normalizeLifecycle } from "./lifecycle-discovery";

export interface RealmBootstrapRequest {
  entry: string;
  ready(module: unknown): void;
  failed(error: unknown): void;
}

export type RealmBootstrapRegistry = Record<string, RealmBootstrapRequest>;
export type RealmWindow = Window & { __MICRO_FRAME_BOOTSTRAP__?: RealmBootstrapRegistry };

export interface ModuleLoaderOptions {
  entry: string;
  frameWindow: RealmWindow;
  hostWindow: Window;
  nativeHead: HTMLHeadElement;
  nativeCreateElement: Document["createElement"];
  bootstrapUrl: string;
  timeout: number;
  signal?: AbortSignal;
  crossOrigin?: string;
}

const moduleRequestSequences = new WeakMap<RealmWindow, number>();

function nextModuleRequestId(frameWindow: RealmWindow): string {
  const sequence = (moduleRequestSequences.get(frameWindow) ?? 0) + 1;
  moduleRequestSequences.set(frameWindow, sequence);
  return `module-${sequence}`;
}

function requestBootstrapUrl(url: string, requestId: string): string {
  const bootstrap = new URL(url);
  bootstrap.searchParams.set("micro-frame-request", requestId);
  return bootstrap.href;
}

export function loadRealmModule(options: ModuleLoaderOptions): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(options.signal.reason); return; }
    const requestId = nextModuleRequestId(options.frameWindow);
    const registry = options.frameWindow.__MICRO_FRAME_BOOTSTRAP__
      ?? Object.create(null) as RealmBootstrapRegistry;
    options.frameWindow.__MICRO_FRAME_BOOTSTRAP__ = registry;
    const bootstrap = options.nativeCreateElement("script");
    bootstrap.type = "module";
    if (options.crossOrigin) bootstrap.crossOrigin = options.crossOrigin;
    bootstrap.src = requestBootstrapUrl(options.bootstrapUrl, requestId);
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) options.hostWindow.clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onAbort);
      delete registry[requestId];
      if (Object.keys(registry).length === 0
        && options.frameWindow.__MICRO_FRAME_BOOTSTRAP__ === registry) {
        delete options.frameWindow.__MICRO_FRAME_BOOTSTRAP__;
      }
      bootstrap.remove();
      action();
    };
    const timeoutId = options.timeout > 0 ? options.hostWindow.setTimeout(() => {
      finish(() => reject(new Error(`Timed out while importing micro application module ${options.entry}.`)));
    }, options.timeout) : undefined;
    const onAbort = () => finish(() => reject(options.signal?.reason));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    registry[requestId] = {
      entry: options.entry,
      ready: (module) => finish(() => resolve(module)),
      failed: (error) => finish(() => reject(new Error(
        `Unable to import application module ${options.entry}: ${String(error)}`,
        { cause: error },
      ))),
    };
    bootstrap.addEventListener("error", () => finish(() => reject(
      new Error(`Unable to load Realm bootstrap: ${bootstrap.src}`),
    )), { once: true });
    options.nativeHead.append(bootstrap);
  });
}

export async function loadLifecycleModule(options: ModuleLoaderOptions): Promise<AppLifecycle> {
  return normalizeLifecycle(await loadRealmModule(options));
}

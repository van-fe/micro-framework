import { createRuntimeInspector } from "./runtime-inspector";
import type {
  ExposedRuntimeInspector,
  InspectableRuntime,
  RuntimeDevtoolsHook,
  RuntimeInspector,
  RuntimeInspectorOptions,
} from "./types";

export const runtimeDevtoolsGlobal = "__MICRO_FRAME_DEVTOOLS__";
const ownedHooks = new WeakSet<RuntimeDevtoolsHook>();

interface MutableHook extends RuntimeDevtoolsHook {
  register(inspector: RuntimeInspector): void;
  unregister(inspector: RuntimeInspector): void;
  readonly size: number;
}

function createHook(): MutableHook {
  const inspectors = new Set<RuntimeInspector>();
  const listeners = new Set<(inspectors: readonly RuntimeInspector[]) => void>();
  const publish = () => {
    const value = Object.freeze([...inspectors]);
    for (const listener of [...listeners]) listener(value);
  };
  return {
    version: 1,
    get size() { return inspectors.size; },
    list: () => Object.freeze([...inspectors]),
    subscribe(listener) {
      listeners.add(listener);
      listener(Object.freeze([...inspectors]));
      return () => listeners.delete(listener);
    },
    register(inspector) { inspectors.add(inspector); publish(); },
    unregister(inspector) { inspectors.delete(inspector); publish(); },
  };
}

export function exposeRuntimeToDevtools(
  hostWindow: Window & typeof globalThis,
  runtime: InspectableRuntime,
  options: RuntimeInspectorOptions = {},
): ExposedRuntimeInspector {
  const current = Reflect.get(hostWindow, runtimeDevtoolsGlobal) as MutableHook | undefined;
  const hook = current?.version === 1 ? current : createHook();
  const ownsHook = hook !== current;
  if (ownsHook) {
    ownedHooks.add(hook);
    Object.defineProperty(hostWindow, runtimeDevtoolsGlobal, {
      configurable: true,
      enumerable: false,
      value: hook,
    });
  }
  const inspector = createRuntimeInspector(runtime, options);
  hook.register(inspector);
  let destroyed = false;
  return {
    inspector,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hook.unregister(inspector);
      inspector.destroy();
      if (ownedHooks.has(hook) && hook.size === 0 && Reflect.get(hostWindow, runtimeDevtoolsGlobal) === hook) {
        Reflect.deleteProperty(hostWindow, runtimeDevtoolsGlobal);
        ownedHooks.delete(hook);
      }
    },
  };
}

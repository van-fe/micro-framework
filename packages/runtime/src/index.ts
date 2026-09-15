import type { RuntimeOptions } from "@micro-framework/contracts";
import { MicroRuntime } from "@micro-framework/runtime-core";

export type * from "@micro-framework/contracts";
export * from "@micro-framework/compat-api";
export { MicroRuntime, createStore } from "@micro-framework/runtime-core";

export function createRuntime(options: RuntimeOptions = {}): MicroRuntime {
  return new MicroRuntime(options);
}

import { MicroRuntime } from "@micro-framework/runtime-core";

let defaultRuntime: MicroRuntime | undefined;

export function getDefaultRuntime(): MicroRuntime {
  defaultRuntime ??= new MicroRuntime();
  return defaultRuntime;
}

import type { RuntimeContext } from "@micro-framework/contracts";
import { inject, type InjectionKey } from "vue";

export const microRuntimeContextKey: InjectionKey<Readonly<RuntimeContext>> =
  Symbol("micro-runtime-context");

export function useMicroRuntime(): Readonly<RuntimeContext> {
  const runtime = inject(microRuntimeContextKey);
  if (!runtime) {
    throw new Error("The component is not mounted by a micro application runtime.");
  }
  return runtime;
}

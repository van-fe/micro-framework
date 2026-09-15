import type { CapabilityErrorCode, CapabilityResult } from "@micro-framework/contracts";

export function failure(
  code: CapabilityErrorCode,
  message: string,
): CapabilityResult<never> & { ok: false } {
  return { ok: false, error: { code, message } };
}

export function isFailure(
  value: unknown,
): value is CapabilityResult<never> & { ok: false } {
  return typeof value === "object" && value !== null && Reflect.get(value, "ok") === false;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

export type HostMessage =
  | { readonly kind: "service-call"; readonly id: number; readonly service: string; readonly method: string; readonly args: readonly unknown[] }
  | { readonly kind: "event-emit"; readonly name: string; readonly payload: unknown };

export type ClientMessage =
  | { readonly kind: "service-result"; readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly kind: "service-result"; readonly id: number; readonly ok: false; readonly error: SerializedError }
  | { readonly kind: "event-deliver"; readonly id: number; readonly payload: unknown };

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Error", message: String(error) };
}

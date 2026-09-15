export function requireObject(
  input: unknown,
  capability: string,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${capability} requires an object input.`);
  }
  return input as Record<string, unknown>;
}

export function requireString(
  input: Record<string, unknown>,
  field: string,
  capability: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${capability} requires a non-empty string ${field} field.`);
  }
  return value;
}

export function optionalString(
  input: Record<string, unknown>,
  field: string,
  capability: string,
): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`${capability} requires ${field} to be a string when provided.`);
  }
  return value;
}

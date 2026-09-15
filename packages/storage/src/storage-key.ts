export function assertStorageKey(key: string): void {
  if (!key || key.trim() !== key) {
    throw new TypeError("Storage key must be a non-empty trimmed string.");
  }
}

export function applicationStorageNamespace(applicationName: string): string {
  if (!applicationName.trim()) throw new TypeError("Application name cannot be empty.");
  return `micro-app:${applicationName}`;
}

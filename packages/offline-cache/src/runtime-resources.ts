/** Framework-created documents are host resources, independent of the application CDN allowlist. */
export function resolveOfflineRealmDocumentUrl(baseUrl: string, supplied?: string): string {
  const host = new URL(baseUrl);
  const url = new URL(supplied ?? "/__micro_frame__/realm.html", host);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== host.origin) {
    throw new TypeError("The offline Realm document must use the host's HTTP(S) origin.");
  }
  // Fragments are document navigation state, never part of an HTTP resource cache key.
  url.hash = "";
  return url.href;
}

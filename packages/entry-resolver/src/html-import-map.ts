import type { ResolvedHtmlImportMap } from './types';

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`HTML Import Map ${label} must be an object.`);
  return value as Record<string, unknown>;
}
function urlLike(value: string): boolean {
  return /^(?:\.\.?\/|\/|[a-z][a-z\d+.-]*:)/i.test(value);
}
function mappings(value: unknown, baseURL: string): Record<string, string | null> {
  const result: Record<string, string | null> = Object.create(null) as Record<string, string | null>;
  for (const [key, address] of Object.entries(record(value, 'specifier mappings'))) {
    const specifier = urlLike(key) ? new URL(key, baseURL).href : key;
    // Invalid addresses block resolution, as native import-map normalization does.
    let target: string | null = null;
    if (typeof address === 'string' && urlLike(address)) {
      try { target = new URL(address, baseURL).href; } catch { /* invalid URL remains blocked */ }
    }
    if (key.endsWith('/') && !target?.endsWith('/')) target = null;
    if (specifier) result[specifier] = target;
  }
  return result;
}
/** Normalize application-relative addresses before moving maps into another Document. */
export function normalizeHtmlImportMaps(scripts: readonly { content: string; nonce?: string }[], baseURL: string): ResolvedHtmlImportMap | undefined {
  const imports: Record<string, string | null> = Object.create(null) as Record<string, string | null>;
  const scopes: Record<string, Record<string, string | null>> = Object.create(null) as Record<string, Record<string, string | null>>;
  let found = false;
  let nonce: string | undefined;
  for (const script of scripts) {
    const map = record(JSON.parse(script.content), 'root');
    const scriptNonce = script.nonce || undefined;
    if (found && nonce !== scriptNonce) throw new TypeError('HTML Import Maps with different CSP nonces cannot be merged.');
    found = true;
    nonce = scriptNonce;
    for (const [key, value] of Object.entries(map.imports === undefined ? {} : mappings(map.imports, baseURL))) {
      if (!Object.hasOwn(imports, key)) imports[key] = value;
    }
    if (map.scopes !== undefined) for (const [scope, values] of Object.entries(record(map.scopes, 'scopes'))) {
      const normalizedScope = new URL(scope, baseURL).href;
      const target = scopes[normalizedScope] ??= Object.create(null) as Record<string, string | null>;
      for (const [key, value] of Object.entries(mappings(values, baseURL))) if (!Object.hasOwn(target, key)) target[key] = value;
    }
  }
  return found ? { imports, scopes, nonce } : undefined;
}

export function collectHtmlImportMap(parsed: Document, baseURL: string): ResolvedHtmlImportMap | undefined {
  const scripts = [...parsed.querySelectorAll<HTMLScriptElement>('script[type="importmap"]')];
  const result = normalizeHtmlImportMaps(scripts.map(script => ({ content: script.textContent ?? '', nonce: script.nonce || undefined })), baseURL);
  for (const script of scripts) script.remove();
  return result;
}

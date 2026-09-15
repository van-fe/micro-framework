export type CspResourceType = "connect" | "script" | "style";
export type ParsedCspPolicy = ReadonlyMap<string, readonly string[]>;

export function parseCspPolicy(value: string): ParsedCspPolicy {
  const directives = new Map<string, readonly string[]>();
  for (const segment of value.split(";")) {
    const [rawName, ...sources] = segment.trim().split(/\s+/);
    const name = rawName?.toLowerCase();
    if (!name || directives.has(name)) continue;
    directives.set(name, sources);
  }
  return directives;
}

function directiveSources(policy: ParsedCspPolicy, type: CspResourceType): readonly string[] | undefined {
  const candidates = type === "script"
    ? ["script-src-elem", "script-src", "default-src"]
    : type === "style"
      ? ["style-src-elem", "style-src", "default-src"]
      : ["connect-src", "default-src"];
  for (const candidate of candidates) {
    const sources = policy.get(candidate);
    if (sources) return sources;
  }
  return undefined;
}

function wildcardHostMatches(source: string, target: URL, documentURL: URL): boolean {
  const schemeIndex = source.indexOf("://");
  const scheme = schemeIndex >= 0 ? source.slice(0, schemeIndex) : documentURL.protocol.slice(0, -1);
  const remainder = schemeIndex >= 0 ? source.slice(schemeIndex + 3) : source;
  const slashIndex = remainder.indexOf("/");
  const authority = slashIndex >= 0 ? remainder.slice(0, slashIndex) : remainder;
  const path = slashIndex >= 0 ? remainder.slice(slashIndex) : undefined;
  const portIndex = authority.lastIndexOf(":");
  const hasExplicitPort = portIndex > authority.lastIndexOf("]");
  const host = (hasExplicitPort ? authority.slice(0, portIndex) : authority).toLowerCase();
  const port = hasExplicitPort ? authority.slice(portIndex + 1) : undefined;
  if (`${scheme}:` !== target.protocol) return false;
  if (port && port !== "*" && port !== target.port) return false;
  const hostMatches = host === "*"
    || (host.startsWith("*.")
      ? target.hostname.toLowerCase().endsWith(host.slice(1))
      : target.hostname.toLowerCase() === host);
  if (!hostMatches) return false;
  if (!path) return true;
  return path.endsWith("/") ? target.pathname.startsWith(path) : target.pathname === path;
}

function sourceMatches(source: string, target: URL, documentURL: URL): boolean {
  const normalized = source.toLowerCase();
  if (normalized === "*") return ["http:", "https:", "ws:", "wss:"].includes(target.protocol);
  if (normalized === "'self'") return target.origin === documentURL.origin;
  if (normalized === "'none'" || normalized.startsWith("'nonce-") || normalized.startsWith("'sha")) {
    return false;
  }
  if (/^[a-z][a-z\d+.-]*:$/i.test(source)) return target.protocol === normalized;
  if (source === "data:" || source === "blob:") return target.protocol === normalized;
  try {
    if (source.includes("*")) return wildcardHostMatches(source, target, documentURL);
    const sourceURL = new URL(source.includes("://") ? source : `${documentURL.protocol}//${source}`);
    const defaultPortMatches = !sourceURL.port || sourceURL.port === target.port;
    if (sourceURL.protocol !== target.protocol
      || sourceURL.hostname.toLowerCase() !== target.hostname.toLowerCase()
      || !defaultPortMatches) return false;
    if (sourceURL.pathname === "/") return true;
    return sourceURL.pathname.endsWith("/")
      ? target.pathname.startsWith(sourceURL.pathname)
      : target.pathname === sourceURL.pathname;
  } catch {
    return false;
  }
}

export function cspAllowsResource(
  policy: ParsedCspPolicy,
  type: CspResourceType,
  resourceURL: string,
  documentURL: string,
): boolean {
  const sources = directiveSources(policy, type);
  if (!sources) return true;
  if (sources.includes("'none'")) return false;
  const target = new URL(resourceURL, documentURL);
  const document = new URL(documentURL);
  return sources.some((source) => sourceMatches(source, target, document));
}

export function cspAllowsUnsafeEval(policy: ParsedCspPolicy): boolean {
  return (policy.get("script-src") ?? policy.get("default-src") ?? []).includes("'unsafe-eval'");
}

export function cspHasReporting(policy: ParsedCspPolicy): boolean {
  return Boolean(policy.get("report-to")?.length || policy.get("report-uri")?.length);
}

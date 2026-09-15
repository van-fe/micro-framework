import type {
  CorsConfigurationOptions,
  CorsConfigurationPlan,
  CorsServerConfiguration,
} from "./types";

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function normalizeOrigin(value: string, label: string): string {
  if (value.includes("*")) throw new Error(`${label} cannot contain a wildcard.`);
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error(`${label} must be an absolute HTTP(S) origin.`); }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label} must be an absolute HTTP(S) origin without credentials.`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain a path, query or fragment.`);
  }
  return parsed.origin;
}

function origins(values: readonly string[], label: string, required: boolean): readonly string[] {
  const result = [...new Set(values.map((value, index) => normalizeOrigin(value, `${label}[${index}]`)))].sort();
  if (required && !result.length) throw new Error(`${label} must contain at least one origin.`);
  return Object.freeze(result);
}

function tokens(values: readonly string[], label: string, upperCase = false): readonly string[] {
  const normalized = values.map((value) => upperCase ? value.toUpperCase() : value);
  for (const value of normalized) {
    if (!TOKEN.test(value)) throw new Error(`${label} contains an invalid token: ${value}`);
  }
  return Object.freeze([...new Set(normalized)].sort());
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function nginxConfiguration(
  allowedOrigins: readonly string[],
  headers: Readonly<Record<string, string>>,
): string {
  const lines: string[] = [];
  if (allowedOrigins.length > 1) {
    lines.push("map $http_origin $micro_frame_cors_origin {", "  default \"\";");
    for (const origin of allowedOrigins) lines.push(`  ${quote(origin)} $http_origin;`);
    lines.push("}", "");
  }
  lines.push("# Add to the location serving micro-application resources.");
  for (const [name, value] of Object.entries(headers)) {
    const rendered = value === "$micro_frame_cors_origin" ? value : quote(value);
    lines.push(`add_header ${name} ${rendered} always;`);
  }
  lines.push("# Return 204 for an allowed OPTIONS preflight after validating $http_origin.");
  return lines.join("\n");
}

export function createCorsConfigurationPlan(
  options: CorsConfigurationOptions,
): CorsConfigurationPlan {
  const allowedOrigins = origins(options.hostOrigins, "hostOrigins", true);
  const resourceOrigins = origins(options.resourceOrigins ?? [], "resourceOrigins", false);
  const methods = tokens(options.methods ?? ["GET", "HEAD", "OPTIONS"], "methods", true);
  const allowedHeaders = tokens(
    options.allowedHeaders ?? ["Content-Type", "If-None-Match", "Range"],
    "allowedHeaders",
  );
  const exposedHeaders = tokens(
    options.exposedHeaders ?? ["Content-Length", "Content-Range", "ETag"],
    "exposedHeaders",
  );
  const maxAgeSeconds = options.maxAgeSeconds ?? 600;
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 0 || maxAgeSeconds > 86_400) {
    throw new Error("maxAgeSeconds must be an integer between 0 and 86400.");
  }
  const allowCredentials = options.allowCredentials ?? false;
  const mode = allowedOrigins.length === 1 ? "static-origin" : "validated-origin-echo";
  const responseHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": mode === "static-origin"
      ? allowedOrigins[0]!
      : "$micro_frame_cors_origin",
    Vary: "Origin",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": allowedHeaders.join(", "),
    "Access-Control-Expose-Headers": exposedHeaders.join(", "),
    "Access-Control-Max-Age": String(maxAgeSeconds),
  };
  if (allowCredentials) responseHeaders["Access-Control-Allow-Credentials"] = "true";
  const server: CorsServerConfiguration = Object.freeze({
    origin: allowedOrigins,
    methods,
    allowedHeaders,
    exposedHeaders,
    credentials: allowCredentials,
    maxAge: maxAgeSeconds,
  });
  const frozenHeaders = Object.freeze(responseHeaders);
  return Object.freeze({
    mode,
    allowedOrigins,
    resourceOrigins,
    responseHeaders: frozenHeaders,
    viteServerCors: server,
    nginx: nginxConfiguration(allowedOrigins, frozenHeaders),
    checks: Object.freeze([
      "Reject request origins that are not in allowedOrigins; never fall back to '*'.",
      "Return the CORS headers on errors, redirects, 304 responses and successful resources.",
      "Answer allowed OPTIONS preflights without forwarding them to application code.",
      "Keep Vary: Origin so shared caches do not mix responses across host origins.",
    ]),
  });
}

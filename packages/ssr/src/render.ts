import { domSurfaceStyleText } from "@micro-framework/dom-surface";

export const ssrSurfaceProtocol = "micro-frame:ssr-surface:v1" as const;

export interface SsrApplicationRenderOptions {
  readonly name: string;
  readonly hydrationKey: string;
  /** Trusted application HTML. Sanitize untrusted input before passing it here. */
  readonly body: string | Iterable<string> | AsyncIterable<string>;
  /** Trusted styles/meta markup rendered inside micro-app-head. */
  readonly head?: string;
  /** Trusted initial overlay markup. */
  readonly overlay?: string;
  readonly delegatesFocus?: boolean;
  readonly hostAttributes?: Readonly<Record<string, string | boolean>>;
}

const reservedAttributes = new Set([
  "data-micro-app",
  "data-micro-hydration-key",
  "data-micro-ssr",
]);

function assertToken(value: string, label: string): void {
  if (!value || value.trim() !== value) throw new TypeError(`${label} must be a non-empty trimmed string.`);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function assertHostAttributeName(name: string): void {
  const normalized = name.toLowerCase();
  const allowed = normalized === "class"
    || normalized === "id"
    || normalized === "lang"
    || normalized === "dir"
    || normalized === "role"
    || normalized === "title"
    || normalized === "hidden"
    || normalized === "inert"
    || normalized === "tabindex"
    || normalized.startsWith("aria-")
    || normalized.startsWith("data-");
  if (!allowed || !/^[a-z_:][a-z0-9:._-]*$/i.test(name) || normalized.startsWith("on")) {
    throw new TypeError(`Unsafe SSR host attribute: ${name}`);
  }
}

function hostAttributes(options: SsrApplicationRenderOptions): string {
  for (const name of Object.keys(options.hostAttributes ?? {})) assertHostAttributeName(name);
  const attributes: Array<[string, string | boolean]> = [
    ["data-micro-app", options.name],
    ["data-micro-hydration-key", options.hydrationKey],
    ["data-micro-ssr", ssrSurfaceProtocol],
    ...Object.entries(options.hostAttributes ?? {}).filter(([name]) => !reservedAttributes.has(name)),
  ];
  return attributes
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => value === true
      ? ` ${name}`
      : value === false
        ? ""
        : ` ${name}="${escapeAttribute(value)}"`
    )
    .join("");
}

async function* bodyChunks(
  body: SsrApplicationRenderOptions["body"],
): AsyncGenerator<string> {
  if (typeof body === "string") {
    yield body;
    return;
  }
  for await (const chunk of body) yield chunk;
}

export async function* renderSsrApplicationStream(
  options: SsrApplicationRenderOptions,
): AsyncGenerator<string> {
  assertToken(options.name, "Application name");
  assertToken(options.hydrationKey, "Hydration key");
  yield `<micro-app-host${hostAttributes(options)}><template shadowrootmode="open"${
    options.delegatesFocus ? " shadowrootdelegatesfocus" : ""
  }><style data-micro-surface-style>${domSurfaceStyleText}</style><micro-app-head>${
    options.head ?? ""
  }</micro-app-head><micro-app-body tabindex="-1" data-micro-app-root="${
    escapeAttribute(options.name)
  }">`;
  for await (const chunk of bodyChunks(options.body)) yield chunk;
  yield `</micro-app-body><micro-app-overlay data-micro-app-overlay="${
    escapeAttribute(options.name)
  }">${options.overlay ?? ""}</micro-app-overlay></template></micro-app-host>`;
}

export async function renderSsrApplication(
  options: SsrApplicationRenderOptions,
): Promise<string> {
  let result = "";
  for await (const chunk of renderSsrApplicationStream(options)) result += chunk;
  return result;
}

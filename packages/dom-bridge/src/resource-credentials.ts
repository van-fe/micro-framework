import type { AppRequestCredentials } from "@micro-framework/contracts";

/** Set request defaults before src/href can initiate fetching; explicit CORS always wins. */
export function applyResourceCredentials<T extends Node>(node: T, credentials?: AppRequestCredentials): T {
  if (credentials === undefined || node.nodeType !== 1) return node;
  const element = node as unknown as Element;
  if ((element.localName === "script" || element.localName === "link")
    && !element.hasAttribute("crossorigin")) {
    element.setAttribute("crossorigin", credentials === "include" ? "use-credentials" : "anonymous");
  }
  return node;
}

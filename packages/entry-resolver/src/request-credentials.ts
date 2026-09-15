import type { AppRequestCredentials } from "@micro-framework/contracts";

export function resourceCrossOrigin(
  element: HTMLScriptElement | HTMLLinkElement,
  credentials: AppRequestCredentials | undefined,
): string | undefined {
  if (element.hasAttribute("crossorigin")) return element.crossOrigin || "anonymous";
  return credentials === "include" ? "use-credentials" : credentials === "same-origin" ? "anonymous" : undefined;
}

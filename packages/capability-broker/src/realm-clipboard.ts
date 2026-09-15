import type { CapabilityErrorCode, RuntimeCapabilities } from "@micro-framework/contracts";

function exceptionName(code: CapabilityErrorCode): string {
  if (code === "denied" || code === "not-allowed") return "NotAllowedError";
  if (code === "policy-blocked") return "SecurityError";
  if (code === "not-available") return "NotSupportedError";
  if (code === "aborted") return "AbortError";
  return "UnknownError";
}

/** Preserve the native text-reading API while mediating its document-sensitive operation. */
export function installRealmClipboardReadText(
  realmWindow: Window & typeof globalThis,
  capabilities: RuntimeCapabilities,
): { destroy(): void } {
  const clipboard = realmWindow.navigator.clipboard;
  if (!clipboard) return { destroy() {} };
  const RealmPromise = realmWindow.Promise;
  const RealmDOMException = realmWindow.DOMException;
  const original = Object.getOwnPropertyDescriptor(clipboard, "readText");
  let active = true;
  const readText = (): Promise<string> => {
    // A disposed iframe's Promise jobs do not run in every engine. This branch
    // belongs to the surviving broker; keep the app's exception brand while
    // returning a rejection whose callbacks can still settle in its caller.
    if (!active) return Promise.reject(new RealmDOMException("Application Realm is disposed.", "AbortError"));
    return RealmPromise.resolve(capabilities.invoke<{ text: string }>("clipboard.read-text"))
      .then(result => {
        if (!active) throw new RealmDOMException("Application Realm is disposed.", "AbortError");
        if (!result.ok) throw new RealmDOMException(result.error.message, exceptionName(result.error.code));
        return result.value.text;
      });
  };
  Object.defineProperty(clipboard, "readText", { configurable: true, writable: true, value: readText });
  return {
    destroy() {
      if (!active) return;
      active = false;
      if (original) Object.defineProperty(clipboard, "readText", original);
      else Reflect.deleteProperty(clipboard, "readText");
    },
  };
}

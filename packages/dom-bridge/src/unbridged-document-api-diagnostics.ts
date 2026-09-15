import type { DocumentBridgeDiagnostic } from "@micro-framework/contracts";

const METHOD_MESSAGES = new Map<PropertyKey, string>([
  ["caretPositionFromPoint", "Caret hit testing still targets the hidden iframe Document."],
  ["caretRangeFromPoint", "Caret hit testing still targets the hidden iframe Document."],
  ["evaluate", "XPath evaluation is not automatically redirected into the application ShadowRoot."],
  ["execCommand", "Legacy editing commands still target the hidden iframe Document."],
  ["queryCommandEnabled", "Legacy editing command state still targets the hidden iframe Document."],
  ["queryCommandIndeterm", "Legacy editing command state still targets the hidden iframe Document."],
  ["queryCommandState", "Legacy editing command state still targets the hidden iframe Document."],
  ["queryCommandSupported", "Legacy editing command state still targets the hidden iframe Document."],
  ["queryCommandValue", "Legacy editing command state still targets the hidden iframe Document."],
]);

const GETTER_MESSAGES = new Map<PropertyKey, string>([
  ["anchors", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["embeds", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["forms", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["images", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["links", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["plugins", "The collection reflects the hidden iframe Document, not the application ShadowRoot."],
  ["styleSheets", "The list reflects the hidden iframe Document, not styles in the application ShadowRoot."],
]);

function restoreProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  try {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  } catch { /* The iframe is removed immediately after bridge cleanup. */ }
}

export interface DocumentApiDiagnosticsInstallation {
  destroy(): void;
}

export function installUnbridgedDocumentApiDiagnostics(options: {
  readonly applicationName: string;
  readonly enabled?: boolean;
  readonly frameDocument: Document;
  readonly hostWindow: Window;
  readonly onDiagnostic?: (diagnostic: DocumentBridgeDiagnostic) => void;
}): DocumentApiDiagnosticsInstallation {
  if (!options.enabled) return { destroy() {} };
  const restores: Array<() => void> = [];
  const reported = new Set<string>();
  const report = (key: PropertyKey, message: string): void => {
    const access = `document.${String(key)}`;
    if (reported.has(access)) return;
    reported.add(access);
    const diagnostic = {
      code: "document-api-unbridged",
      applicationName: options.applicationName,
      access,
      message: `${message} Install a named Document Bridge plugin when this API is required.`,
      blocked: false,
    } satisfies DocumentBridgeDiagnostic;
    try { options.onDiagnostic?.(diagnostic); }
    catch (error) {
      const hostConsole = Reflect.get(options.hostWindow, "console") as Console;
      hostConsole.error("Document Bridge diagnostic callback failed.", error);
    }
    if (!options.onDiagnostic) {
      const hostConsole = Reflect.get(options.hostWindow, "console") as Console;
      hostConsole.warn(`[micro-frame:${options.applicationName}] ${diagnostic.message}`);
    }
  };
  const define = (key: PropertyKey, descriptor: PropertyDescriptor): void => {
    if (Object.prototype.hasOwnProperty.call(options.frameDocument, key)) return;
    const previous = Object.getOwnPropertyDescriptor(options.frameDocument, key);
    try {
      Object.defineProperty(options.frameDocument, key, { configurable: true, ...descriptor });
      restores.push(() => restoreProperty(options.frameDocument, key, previous));
    } catch { /* Some browser-owned Document members cannot be shadowed. */ }
  };

  for (const [key, message] of METHOD_MESSAGES) {
    const native = Reflect.get(options.frameDocument, key, options.frameDocument);
    if (typeof native !== "function") continue;
    define(key, {
      writable: true,
      value: (...args: unknown[]) => {
        report(key, message);
        return Reflect.apply(native, options.frameDocument, args);
      },
    });
  }
  for (const [key, message] of GETTER_MESSAGES) {
    const native = Reflect.get(options.frameDocument, key, options.frameDocument);
    define(key, {
      get: () => {
        report(key, message);
        return native;
      },
    });
  }

  return {
    destroy() {
      for (const restore of restores.reverse()) restore();
      restores.splice(0);
      reported.clear();
    },
  };
}

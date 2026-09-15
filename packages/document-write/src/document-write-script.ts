import type { DefaultTreeAdapterTypes as Ast } from "parse5";

const CLASSIC_TYPES = new Set(["", "application/ecmascript", "application/javascript", "application/x-ecmascript", "application/x-javascript", "text/ecmascript", "text/javascript", "text/javascript1.0", "text/javascript1.1", "text/javascript1.2", "text/javascript1.3", "text/javascript1.4", "text/javascript1.5", "text/jscript", "text/livescript", "text/x-ecmascript", "text/x-javascript"]);

export function hasExecutableScriptType(node: Ast.Element): boolean {
  const type = node.attrs.find((attr) => attr.name === "type")?.value.trim().toLowerCase() ?? "";
  return type === "module" || CLASSIC_TYPES.has(type);
}

export function isExecutableWrittenScript(node: Ast.Element): boolean {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (ancestor.nodeName === "#document-fragment") return false;
    ancestor = "parentNode" in ancestor ? ancestor.parentNode : null;
  }
  const module = node.attrs.some((attr) => attr.name === "type" && attr.value.trim().toLowerCase() === "module");
  return hasExecutableScriptType(node) && (module || !node.attrs.some((attr) => attr.name === "nomodule"));
}

export interface WrittenScriptExecution {
  script: HTMLScriptElement;
  asynchronous: boolean;
  completion: Promise<void>;
  start(): void;
  cancel(): void;
}

export function prepareWrittenScript(options: {
  node: Ast.Element;
  nativeHead: HTMLHeadElement;
  createElement: Document["createElement"];
  baseURL: string;
  prepareResource<T extends Node>(node: T): T;
}): WrittenScriptExecution {
  const script = options.createElement("script");
  for (const attr of options.node.attrs) script.setAttribute(attr.name, attr.value);
  if (script.type.trim().toLowerCase() === "module") script.type = "module";
  options.prepareResource(script);
  const source = script.getAttribute("src");
  if (source) script.src = new URL(source, options.baseURL).href;
  script.textContent = options.node.childNodes.map((node) => "value" in node ? node.value : "").join("");
  script.async = false;
  const asynchronous = Boolean(source || script.type === "module");
  const frameWindow = options.nativeHead.ownerDocument.defaultView;
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  let settled = false;
  let synchronousError: unknown;
  let moduleTimer: number | undefined;
  const completion = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  // Failures are consumed by the controller's flush, including synchronous callers.
  void completion.catch(() => {});
  const finish = (error?: unknown): void => {
    if (settled) return;
    settled = true;
    if (moduleTimer !== undefined) frameWindow?.clearTimeout(moduleTimer);
    script.removeEventListener("load", onLoad);
    script.removeEventListener("error", onError);
    frameWindow?.removeEventListener("error", onWindowError);
    if (error) reject(error); else resolve();
  };
  const onLoad = () => finish();
  const onError = () => finish(new Error(`Unable to load document.write script: ${script.src || "inline module"}`));
  const onWindowError = (event: ErrorEvent) => {
    if (source && event.filename && event.filename !== script.src) return;
    synchronousError = event.error ?? new Error(event.message);
    finish(synchronousError);
  };
  return {
    script,
    asynchronous,
    completion,
    start() {
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      frameWindow?.addEventListener("error", onWindowError);
      try {
        options.nativeHead.append(script);
        if (!asynchronous) finish(synchronousError);
        // Schedule inline modules natively; their readiness is not observable.
        // Yield without waiting for completion; external modules use load events.
        else if (!source) moduleTimer = frameWindow?.setTimeout(() => finish(), 0);
      } catch (error) { finish(error); throw error; }
      if (!asynchronous && synchronousError) throw synchronousError;
    },
    cancel() {
      if (source && !settled && script.isConnected) {
        // WebKit reports currentScript as null for removed scripts which still
        // finish loading. Keep their identity until completion so stale writes
        // remain attributable, then discard the native execution node.
        const remove = () => {
          script.removeEventListener("load", remove);
          script.removeEventListener("error", remove);
          script.remove();
        };
        script.addEventListener("load", remove, { once: true });
        script.addEventListener("error", remove, { once: true });
      } else script.remove();
      finish();
    },
  };
}

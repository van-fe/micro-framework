import type { DomGuardDiagnostic } from "@micro-framework/contracts";

export interface DomGuardOptions {
  readonly applicationName: string;
  readonly diagnostics?: boolean;
  readonly onDiagnostic?: (diagnostic: DomGuardDiagnostic) => void;
}

export interface DomGuardInstallation {
  trackVisualNode(node: Node): void;
  destroy(): void;
}

function findTrackedNode(root: Node, tracked: WeakSet<Node>): Node | undefined {
  if (tracked.has(root)) return root;
  for (const child of root.childNodes) {
    const match = findTrackedNode(child, tracked);
    if (match) return match;
  }
  return undefined;
}

export function installDomGuard(
  frameWindow: Window,
  hostWindow: Window,
  applicationRoot: ShadowRoot,
  options: DomGuardOptions,
): DomGuardInstallation {
  const tracked = new WeakSet<Node>();
  const reportedNodes = new WeakSet<Node>();
  const reportedAccess = new Set<string>();
  const restoreProperties: Array<() => void> = [];
  let destroyed = false;
  const report = (
    code: DomGuardDiagnostic["code"],
    access: string,
    message: string,
    blocked: boolean,
  ): void => {
    const diagnostic = {
      code,
      applicationName: options.applicationName,
      access,
      message,
      blocked,
    } satisfies DomGuardDiagnostic;
    try { options.onDiagnostic?.(diagnostic); }
    catch (error) {
      const hostConsole = Reflect.get(hostWindow, "console") as Console;
      hostConsole.error("DOM Guard diagnostic callback failed.", error);
    }
    if (options.diagnostics && !options.onDiagnostic) {
      const hostConsole = Reflect.get(hostWindow, "console") as Console;
      hostConsole.warn(`[micro-frame:${options.applicationName}] ${message}`);
    }
  };

  if (options.diagnostics) {
    for (const [access, value] of [
      ["window.parent", frameWindow.parent],
      ["window.top", frameWindow.top],
      ["window.frameElement", frameWindow.frameElement],
    ] as const) {
      try {
        const property = access.slice("window.".length);
        const previous = Object.getOwnPropertyDescriptor(frameWindow, property);
        Object.defineProperty(frameWindow, property, {
          configurable: true,
          get() {
            if (!reportedAccess.has(access)) {
              reportedAccess.add(access);
              report(
                "host-window-access",
                access,
                `${access} reaches outside the application Realm; use runtime services or capabilities instead.`,
                false,
              );
            }
            return value;
          },
        });
        restoreProperties.push(() => {
          if (previous) Object.defineProperty(frameWindow, property, previous);
          else Reflect.deleteProperty(frameWindow, property);
        });
      } catch { /* Static analysis still reports globals a browser does not allow the iframe to wrap. */ }
    }
  }

  const serviceWorker = frameWindow.navigator.serviceWorker;
  if (serviceWorker) {
    const blockedRegister = () => {
      const message = "Service Worker registration is disabled inside a micro application Realm.";
      report("service-worker-blocked", "navigator.serviceWorker.register", message, true);
      const HostDOMException = Reflect.get(hostWindow, "DOMException") as typeof DOMException;
      return Promise.reject(new HostDOMException(message, "NotAllowedError"));
    };
    const blockedContainer = new Proxy(serviceWorker, {
      get(target, key) {
        if (key === "register") return blockedRegister;
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    let navigatorWrapped = false;
    try {
      const previous = Object.getOwnPropertyDescriptor(frameWindow.navigator, "serviceWorker");
      Object.defineProperty(frameWindow.navigator, "serviceWorker", {
        configurable: true,
        get: () => blockedContainer,
      });
      navigatorWrapped = true;
      restoreProperties.push(() => {
        if (previous) Object.defineProperty(frameWindow.navigator, "serviceWorker", previous);
        else Reflect.deleteProperty(frameWindow.navigator, "serviceWorker");
      });
    } catch { /* Fall back to the iframe's ServiceWorkerContainer wrapper. */ }
    if (!navigatorWrapped) {
      try {
        const previous = Object.getOwnPropertyDescriptor(serviceWorker, "register");
        Object.defineProperty(serviceWorker, "register", {
          configurable: true,
          writable: true,
          value: blockedRegister,
        });
        restoreProperties.push(() => {
          if (previous) Object.defineProperty(serviceWorker, "register", previous);
          else Reflect.deleteProperty(serviceWorker, "register");
        });
      } catch { /* The browser remains authoritative when both wrappers are sealed. */ }
    }
  }

  const HostMutationObserver = Reflect.get(hostWindow, "MutationObserver") as typeof MutationObserver;
  const observer = new HostMutationObserver((records) => {
    if (destroyed) return;
    for (const record of records) {
      for (const added of record.addedNodes) {
        const escaped = findTrackedNode(added, tracked);
        if (!escaped || applicationRoot.contains(escaped) || reportedNodes.has(escaped)) continue;
        reportedNodes.add(escaped);
        report(
          "dom-escape",
          escaped.nodeName.toLowerCase(),
          `A visual node created by ${options.applicationName} was inserted outside its ShadowRoot.`,
          false,
        );
      }
    }
  });
  if (options.diagnostics) {
    observer.observe(hostWindow.document.documentElement, { childList: true, subtree: true });
  }

  return {
    trackVisualNode(node) {
      if (!destroyed) tracked.add(node);
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      for (const restore of restoreProperties.reverse()) restore();
      restoreProperties.splice(0);
      reportedAccess.clear();
    },
  };
}

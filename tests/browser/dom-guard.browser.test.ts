import { installDocumentBridge } from "@micro-framework/dom-bridge";
import { installDomGuard } from "@micro-framework/dom-guard";
import { createDomSurface } from "@micro-framework/dom-surface";
import type { DomGuardDiagnostic } from "@micro-framework/contracts";
import { afterEach, describe, expect, it } from "vitest";

const containers = new Set<HTMLElement>();

async function createRealm(): Promise<{
  container: HTMLElement;
  frame: HTMLIFrameElement;
  frameWindow: Window & typeof globalThis;
  surface: ReturnType<typeof createDomSurface>;
}> {
  const container = document.createElement("main");
  document.body.append(container);
  containers.add(container);
  const surface = createDomSurface(container, "guard-contract", "guard-contract:1");
  const frame = document.createElement("iframe");
  frame.hidden = true;
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  surface.host.append(frame);
  await loaded;
  const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
  if (!frameWindow) throw new Error("Missing same-origin iframe Realm.");
  return { container, frame, frameWindow, surface };
}

async function flushMutations(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

afterEach(() => {
  for (const container of containers) container.remove();
  containers.clear();
});

describe("real-browser DOM Guard contracts", () => {
  it("diagnoses host Window access and tracked visual nodes escaping the ShadowRoot", async () => {
    const { frameWindow, surface } = await createRealm();
    const diagnostics: DomGuardDiagnostic[] = [];
    const guard = installDomGuard(frameWindow, window, surface.shadowRoot, {
      applicationName: "guard-contract",
      diagnostics: true,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const bridge = installDocumentBridge(frameWindow, window, surface, {
      trackVisualNode: (node) => guard.trackVisualNode(node),
    });

    void frameWindow.parent;
    void frameWindow.parent;
    const escaped = frameWindow.document.createElement("aside");
    document.body.append(escaped);
    await flushMutations();

    expect(diagnostics.filter(({ code }) => code === "host-window-access")).toHaveLength(1);
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "dom-escape",
      applicationName: "guard-contract",
      access: "aside",
      blocked: false,
    }));

    escaped.remove();
    bridge.destroy();
    guard.destroy();
    surface.destroy();
  });

  it("blocks Service Worker registration on the iframe Navigator instance", async () => {
    const { frameWindow, surface } = await createRealm();
    const diagnostics: DomGuardDiagnostic[] = [];
    const guard = installDomGuard(frameWindow, window, surface.shadowRoot, {
      applicationName: "guard-contract",
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    if ("serviceWorker" in frameWindow.navigator) {
      await expect(frameWindow.navigator.serviceWorker.register("/must-not-register.js"))
        .rejects.toMatchObject({ name: "NotAllowedError" });
      expect(diagnostics).toContainEqual(expect.objectContaining({
        code: "service-worker-blocked",
        blocked: true,
      }));
    }

    guard.destroy();
    surface.destroy();
  });
});

import type { AppProps } from "@micro-framework/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reactDom = vi.hoisted(() => {
  const selectionListener = vi.fn();
  const root = { render: vi.fn(), unmount: vi.fn() };
  return {
    selectionListener,
    root,
    createRoot: vi.fn((container: { ownerDocument: Document }) => {
      container.ownerDocument.addEventListener("selectionchange", selectionListener);
      return root;
    }),
    hydrateRoot: vi.fn(),
  };
});

vi.mock("react-dom/client", () => ({
  createRoot: reactDom.createRoot,
  hydrateRoot: reactDom.hydrateRoot,
}));

import { createReactLifecycle } from "./react-lifecycle";

describe("createReactLifecycle", () => {
  beforeEach(() => {
    reactDom.selectionListener.mockClear();
    reactDom.root.render.mockClear();
    reactDom.root.unmount.mockClear();
    reactDom.createRoot.mockClear();
  });

  it("removes owner-Document listeners installed while creating the React root", () => {
    const ownerDocument = new EventTarget() as unknown as Document;
    const nativeAdd = ownerDocument.addEventListener;
    const container = { ownerDocument } as unknown as HTMLElement;
    const lifecycle = createReactLifecycle({ render: () => null });
    const props = {
      container,
      $runtime: { signal: new AbortController().signal },
    } as unknown as AppProps<object>;
    if (typeof lifecycle.mount !== "function" || typeof lifecycle.unmount !== "function") {
      throw new Error("Expected function lifecycles.");
    }

    lifecycle.mount(props);
    expect(ownerDocument.addEventListener).toBe(nativeAdd);
    ownerDocument.dispatchEvent(new Event("selectionchange"));
    expect(reactDom.selectionListener).toHaveBeenCalledTimes(1);

    lifecycle.unmount(props);
    ownerDocument.dispatchEvent(new Event("selectionchange"));
    expect(reactDom.selectionListener).toHaveBeenCalledTimes(1);
    expect(reactDom.root.unmount).toHaveBeenCalledOnce();
  });

  it("removes captured listeners when React root creation fails", () => {
    const ownerDocument = new EventTarget() as unknown as Document;
    const container = { ownerDocument } as unknown as HTMLElement;
    const lifecycle = createReactLifecycle({ render: () => null });
    if (typeof lifecycle.mount !== "function") throw new Error("Expected a mount function.");
    const mount = lifecycle.mount;
    reactDom.createRoot.mockImplementationOnce((failedContainer: { ownerDocument: Document }) => {
      failedContainer.ownerDocument.addEventListener("selectionchange", reactDom.selectionListener);
      throw new Error("injected root creation failure");
    });

    expect(() => mount({
      container,
      $runtime: { signal: new AbortController().signal },
    } as unknown as AppProps<object>)).toThrow("injected root creation failure");
    ownerDocument.dispatchEvent(new Event("selectionchange"));
    expect(reactDom.selectionListener).not.toHaveBeenCalled();
  });
});

import type { AppProps } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import { createVanillaLifecycle } from "./vanilla-lifecycle";

describe("createVanillaLifecycle", () => {
  it("owns renderer cleanup and makes repeated unmount harmless", async () => {
    const cleanup = vi.fn();
    const render = vi.fn(() => cleanup);
    const lifecycle = createVanillaLifecycle({ render });
    const props = { container: {}, name: "demo", $runtime: {} } as AppProps;

    await lifecycle.mount(props);
    await lifecycle.unmount(props);
    await lifecycle.unmount(props);

    expect(render).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

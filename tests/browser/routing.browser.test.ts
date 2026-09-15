import { MicroRuntime } from "@micro-framework/runtime-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const runtimes = new Set<MicroRuntime>();
let originalURL = location.href;

afterEach(async () => {
  await Promise.all([...runtimes].map((runtime) => runtime.destroy()));
  runtimes.clear();
  history.replaceState(history.state, "", originalURL);
  document.querySelector("#hash-route-slot")?.remove();
});

describe("real-browser routing mode contracts", () => {
  it("uses only hashchange and matches the normalized hash path in hash mode", async () => {
    originalURL = location.href;
    history.replaceState(history.state, "", `${location.pathname}${location.search}#/idle`);
    const slot = document.createElement("div");
    slot.id = "hash-route-slot";
    document.body.append(slot);
    const runtime = new MicroRuntime({
      routing: { mode: "hash" },
      bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
    });
    runtimes.add(runtime);
    runtime.registerApps([{
      name: "hash-route-contract",
      entry: { url: "/hash-route-entry.js", type: "module" },
      container: slot,
      activeWhen: "/orders",
    }]);
    await runtime.start();
    expect(runtime.getAppStatus("hash-route-contract")).toBe("registered");

    history.replaceState(history.state, "", `${location.pathname}${location.search}#/orders/42`);
    dispatchEvent(new HashChangeEvent("hashchange"));
    await vi.waitFor(() => expect(runtime.getAppStatus("hash-route-contract")).toBe("mounted"));
    expect(slot.querySelector("micro-app-host")?.shadowRoot?.querySelector("#hash-route-root")?.textContent)
      .toBe("hash route mounted");

    history.replaceState(history.state, "", `${location.pathname}${location.search}#/idle`);
    dispatchEvent(new PopStateEvent("popstate"));
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(runtime.getAppStatus("hash-route-contract")).toBe("mounted");

    dispatchEvent(new HashChangeEvent("hashchange"));
    await vi.waitFor(() => expect(runtime.getAppStatus("hash-route-contract")).toBe("unmounted"));
    expect(slot.querySelector("micro-app-host")).toBeNull();
  });
});

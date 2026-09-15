import { createRuntime, type AppHandle, type MicroRuntime } from "@micro-framework/runtime";

declare global {
  interface Window {
    __ssrRuntime__?: MicroRuntime;
    __ssrHandle__?: AppHandle<{ title: string }>;
    __ssrHydrationState__?: {
      sameHost: boolean;
      sameRoot: boolean;
      instanceId: string;
    };
  }
}

const slot = document.querySelector<HTMLElement>("#ssr-slot")!;
const serverHost = slot.querySelector<HTMLElement>("micro-app-host")!;
const serverRoot = serverHost.shadowRoot!.querySelector<HTMLElement>("[data-ssr-root]")!;
const runtime = createRuntime();
window.__ssrRuntime__ = runtime;
const framework = new URL(location.href).searchParams.get("framework");
const frameworkEntry = framework === "react" || framework === "vue"
  ? new URL(`/assets/${framework}-hydration.js`, location.href).href
  : "http://127.0.0.1:4274/assets/ssr-lifecycle.js";

const handle = await runtime.mountApp({
  name: "ssr-orders",
  entry: { url: frameworkEntry, type: "module" },
  container: slot,
  hydration: { key: "orders-main", onMismatch: "error" },
  props: { title: "Server orders" },
});
window.__ssrHandle__ = handle;
// Exercise an immediate update: React must finish its initial hydration commit first.
if (framework) await handle.update({ title: "Hydrated orders" });
const hydratedHost = slot.querySelector<HTMLElement>("micro-app-host")!;
const hydratedRoot = hydratedHost.shadowRoot!.querySelector<HTMLElement>("[data-ssr-root]")!;
window.__ssrHydrationState__ = {
  sameHost: serverHost === hydratedHost,
  sameRoot: serverRoot === hydratedRoot,
  instanceId: handle.instanceId,
};
document.documentElement.dataset.ssrClientReady = "";

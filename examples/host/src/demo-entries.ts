import type { AppEntry } from "@micro-framework/runtime";

const staticDemo = import.meta.env.VITE_MICRO_FRAME_STATIC_DEMO === "true";
const hostBase = new URL(import.meta.env.BASE_URL, location.href);
const hosted = (path: string) => new URL(path, hostBase).href;

function hostedEntry(application: string): AppEntry {
  return { url: hosted(`apps/${application}/micro.html`), type: "html" };
}

export const demoEntries: Record<"vanilla" | "react" | "vue" | "vue2", AppEntry> = staticDemo ? {
  vanilla: hostedEntry("vanilla"),
  react: hostedEntry("react"),
  vue: hostedEntry("vue"),
  vue2: hostedEntry("vue2"),
} : {
  vanilla: { url: "http://127.0.0.1:5174/micro.html", type: "html" },
  react: { url: "http://127.0.0.1:5175/src/lifecycle.tsx", type: "module" },
  vue: { url: "http://127.0.0.1:5176/src/lifecycle.ts", type: "module" },
  vue2: { url: "http://127.0.0.1:5179/src/lifecycle.ts", type: "module" },
};

export const demoRealm = staticDemo ? {
  realmDocumentUrl: hosted("__micro_frame__/realm.html"),
  bootstrapUrl: hosted("assets/realm-bootstrap.js"),
} : {};

export const demoSharedUrl = staticDemo
  ? hosted("apps/vanilla/assets/shared-marker.js")
  : "http://127.0.0.1:5174/src/shared-marker.ts";

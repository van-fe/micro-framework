import { installDocumentWrite } from "@micro-framework/document-write";
import type { AppEntry, AppLifecycle, AppRequestCredentials } from "@micro-framework/contracts";
import { createDomSurface } from "@micro-framework/dom-surface";
import { prefetchEntryResources } from "@micro-framework/entry-resolver";
import { RealmHost } from "@micro-framework/realm-host";
import { afterEach, describe, expect, it } from "vitest";

interface RequestRecord { path: string; cookie: string; origin: string }
const cleanups: (() => void)[] = [];

async function invoke(phase: AppLifecycle["mount"]): Promise<void> {
  for (const callback of typeof phase === "function" ? [phase] : phase) await callback({} as never);
}

async function loadCrossOrigin(type: "html" | "module", credentials?: AppRequestCredentials) {
  const { origin } = await (await fetch("/upstream-credentials-origin")).json() as { origin: string };
  expect(origin).not.toBe(location.origin);
  const token = `q341_${crypto.randomUUID().replaceAll("-", "")}`;
  document.cookie = `${token}=credential; Path=/; SameSite=Lax`;
  cleanups.push(() => { document.cookie = `${token}=; Path=/; Max-Age=0`; });
  const entry: AppEntry = { url: `${origin}/${token}/entry.${type === "html" ? "html" : "js"}`, type, credentials };
  await prefetchEntryResources(entry, location.href, window);
  const container = document.createElement("main");
  document.body.appendChild(container);
  const surface = createDomSurface(container, token, token);
  const realm = new RealmHost(surface, { documentWrite: type === "html" ? installDocumentWrite : undefined, bootstrapUrl: new URL("/realm-bootstrap.js", location.href).href });
  cleanups.push(() => { realm.destroy(); surface.destroy(); container.remove(); });
  const lifecycle = await realm.load(entry);
  await invoke(lifecycle.mount);
  const frame = realm.iframe!.contentWindow!;
  const records = await (await fetch(`${origin}/records?case=${token}`)).json() as RequestRecord[];
  return { frame, records, token, entry };
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

describe("upstream cross-origin request credentials", () => {
  for (const type of ["html", "module"] as const) {
    for (const credentials of ["same-origin", "include"] as const) {
      it(`Q341 propagates ${credentials} from ${type} entry through native ESM graphs and dynamic resources`, async () => {
        const { frame, records, token } = await loadCrossOrigin(type, credentials);
        const expectedPaths = [
          `entry.${type === "html" ? "html" : "js"}`, "dependency.js", "preloaded-static.js", "startup-chunk.js",
          "runtime-chunk.js", "dynamic-classic.js", "dynamic-module.js", "dynamic-module-dependency.js",
          "dynamic-module-chunk.js", "dynamic-style.css", "dynamic-preloaded.js", "dynamic-override.js",
          ...(type === "html" ? ["classic.js", "html-module.js", "static-style.css", "static-override.js", "module-override.js", "written.js", "written-style.css"] : []),
        ];
        expect(new Set(records.map((record) => record.path.split("/").at(-1)))).toEqual(new Set(expectedPaths));
        for (const record of records) {
          const explicitAnonymous = /(?:static|module|dynamic)-override\.js$/.test(record.path);
          expect(record.cookie.includes(`${token}=credential`), record.path).toBe(credentials === "include" && !explicitAnonymous);
          expect(record.origin, record.path).toBe(location.origin);
        }
        const crossOrigin = credentials === "include" ? "use-credentials" : "anonymous";
        const metadata = Reflect.get(frame, "__credentialMetadata") as string[][];
        expect(metadata).toEqual([
          ["dynamic-classic.js", crossOrigin], ["dynamic-module.js", crossOrigin],
          ["dynamic-style.css", crossOrigin], ["dynamic-override.js", "anonymous"],
          ["dynamic-preloaded.js", crossOrigin],
        ]);
        const nativePreloads = realmPreloads(frame);
        expect(nativePreloads.length).toBeGreaterThan(0);
        for (const preload of nativePreloads) {
          expect(preload.ownerDocument).toBe(frame.document);
          expect(preload.crossOrigin).toBe(preload.href.endsWith("module-override.js") ? "anonymous" : crossOrigin);
        }
        expect(nativePreloads.some((preload) => preload.href.endsWith("dynamic-preloaded.js"))).toBe(true);
        expect(Reflect.get(window, "__credentialExecutions")).toBeUndefined();
      });
    }
  }

  it("Q341 preserves native resource defaults when entry credentials are omitted", async () => {
    const { records, token } = await loadCrossOrigin("module");
    for (const record of records) {
      const nativeCredentialedTag = /dynamic-(?:classic\.js|style\.css)$/.test(record.path);
      expect(record.cookie.includes(`${token}=credential`), record.path).toBe(nativeCredentialedTag);
    }
  });
});

function realmPreloads(frame: Window): HTMLLinkElement[] {
  // The bridged document query routes to the visible surface, so use the iframe-native getter.
  const FrameDocument = Reflect.get(frame, "Document") as typeof Document;
  const head = Object.getOwnPropertyDescriptor(FrameDocument.prototype, "head")!.get!.call(frame.document) as HTMLHeadElement;
  return [...head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')];
}

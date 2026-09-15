import { createDomSurface } from "@micro-framework/dom-surface";
import { RealmHost, type RealmHostOptions } from "@micro-framework/realm-host";
import { afterEach } from "vitest";

const cleanup: Array<() => void | Promise<void>> = [];
export function addEntryCleanup(destroy: () => void | Promise<void>): void { cleanup.push(destroy); }
afterEach(async () => { for (const destroy of cleanup.splice(0).reverse()) await destroy(); });

export async function entryOrigin(): Promise<string> {
  return (await (await fetch("/__batch02-entry")).json() as { origin: string }).origin;
}

export async function entryApplication(path: string, options: RealmHostOptions = {}) {
  const origin = await entryOrigin();
  const container = document.createElement("main");
  document.body.append(container);
  const surface = createDomSurface(container, "batch02-entry", crypto.randomUUID());
  const realm = new RealmHost(surface, { bootstrapUrl: new URL("/realm-bootstrap.js", location.href).href, ...options });
  addEntryCleanup(() => { realm.destroy(); surface.destroy(); container.remove(); });
  const lifecycle = await realm.load({ type: "html", url: origin + path });
  const frame = realm.iframe!.contentWindow! as Window & typeof globalThis;
  return { origin, surface, realm, lifecycle, frame, container };
}

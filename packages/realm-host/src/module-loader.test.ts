import { describe, expect, it } from "vitest";
import {
  loadRealmModule,
  type ModuleLoaderOptions,
  type RealmBootstrapRegistry,
  type RealmWindow,
} from "./module-loader";

interface FakeScript {
  type: string;
  src: string;
  addEventListener(): void;
  remove(): void;
}

function loaderOptions(frameWindow: RealmWindow, sources: string[]): ModuleLoaderOptions {
  const nativeHead = {
    append(script: FakeScript) {
      sources.push(script.src);
      const requestId = new URL(script.src).searchParams.get("micro-frame-request");
      if (!requestId) throw new Error("Missing module request ID.");
      queueMicrotask(() => {
        const registry = frameWindow.__MICRO_FRAME_BOOTSTRAP__ as RealmBootstrapRegistry;
        registry[requestId]?.ready({ requestId });
      });
    },
  };
  return {
    entry: "https://app.example.test/entry.js",
    frameWindow,
    hostWindow: globalThis as unknown as Window,
    nativeHead: nativeHead as unknown as HTMLHeadElement,
    nativeCreateElement: (() => ({
      type: "",
      src: "",
      addEventListener() {},
      remove() {},
    })) as unknown as Document["createElement"],
    bootstrapUrl: "https://host.example.test/realm-bootstrap.js",
    timeout: 1_000,
  };
}

function requestId(source: string): string | null {
  return new URL(source).searchParams.get("micro-frame-request");
}

describe("Realm module request URLs", () => {
  it("preserves the failed entry URL and original browser error when import rejects", async () => {
    const frameWindow = {} as RealmWindow;
    const options = loaderOptions(frameWindow, []);
    const browserError = new TypeError("Importing a module script failed.");
    options.nativeHead = {
      append(script: FakeScript) {
        const id = requestId(script.src)!;
        queueMicrotask(() => frameWindow.__MICRO_FRAME_BOOTSTRAP__![id]!.failed(browserError));
      },
    } as unknown as HTMLHeadElement;
    const error = await loadRealmModule(options).catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message", `Unable to import application module ${options.entry}: TypeError: Importing a module script failed.`);
    expect(error).toHaveProperty("cause", browserError);
    expect(frameWindow.__MICRO_FRAME_BOOTSTRAP__).toBeUndefined();
  });

  it("increments inside one Realm but reuses the bounded sequence in a new Realm", async () => {
    const sources: string[] = [];
    const firstRealm = {} as RealmWindow;

    await loadRealmModule(loaderOptions(firstRealm, sources));
    await loadRealmModule(loaderOptions(firstRealm, sources));
    await loadRealmModule(loaderOptions({} as RealmWindow, sources));

    expect(sources.map(requestId)).toEqual(["module-1", "module-2", "module-1"]);
    expect(firstRealm.__MICRO_FRAME_BOOTSTRAP__).toBeUndefined();
  });
});

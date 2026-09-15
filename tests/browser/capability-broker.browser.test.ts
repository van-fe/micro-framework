import { BrowserCapabilityBroker } from "@micro-framework/capability-broker";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

const hosts = new Set<HTMLElement>();

function createBroker(allow: ConstructorParameters<typeof BrowserCapabilityBroker>[0]["allow"]): {
  broker: BrowserCapabilityBroker;
  host: HTMLElement;
} {
  const host = document.createElement("section");
  host.attachShadow({ mode: "open" });
  document.body.append(host);
  hosts.add(host);
  return {
    host,
    broker: new BrowserCapabilityBroker({ hostWindow: window, applicationHost: host, allow }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const host of hosts) host.remove();
  hosts.clear();
});

describe("real-browser Capability Broker contracts", () => {
  it("reports the capability surface of the actual browser engine", async () => {
    const { broker } = createBroker([]);

    const result = await broker.invoke<Record<string, boolean>>("environment.features");

    expect(result).toMatchObject({
      ok: true,
      value: {
        shadowDom: true,
        modules: true,
        structuredClone: true,
        abortController: true,
        webStorage: true,
        indexedDB: "indexedDB" in window,
        broadcastChannel: "BroadcastChannel" in window,
        sharedWorker: "SharedWorker" in window,
        webLocks: "locks" in navigator,
        userActivation: "userActivation" in navigator,
        permissions: "permissions" in navigator,
        clipboard: "clipboard" in navigator,
        mediaDevices: "mediaDevices" in navigator,
        fullscreen: "requestFullscreen" in document.documentElement,
        pointerLock: "requestPointerLock" in document.documentElement,
      },
    });
    await broker.destroy();
  });

  it("accepts a privileged request only during a real host user gesture", async () => {
    const { broker, host } = createBroker(["popup.open"]);
    const close = vi.fn();
    const popup = { closed: false, close } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);

    const button = document.createElement("button");
    button.textContent = "Open application link";
    host.shadowRoot?.append(button);
    let invoked: Promise<unknown> | undefined;
    let activeDuringClick = false;
    button.addEventListener("click", () => {
      activeDuringClick = navigator.userActivation.isActive;
      invoked = broker.invoke("popup.open", { url: "/inside", target: "app-window" });
    });

    await userEvent.click(button);
    const insideGesture = await invoked;

    expect(activeDuringClick).toBe(true);
    expect(insideGesture).toEqual({ ok: true, value: { opened: true } });
    expect(open).toHaveBeenCalledWith(
      new URL("/inside", document.baseURI),
      "app-window",
      undefined,
    );
    await broker.destroy();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses structured clones and releases media resources owned by the application", async () => {
    const { broker, host } = createBroker(["media.user.request"]);
    const stop = vi.fn();
    const getUserMedia = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
      async (constraints) => {
        ((constraints as MediaStreamConstraints).video as MediaTrackConstraints).width = 1920;
        return {
          getTracks: () => [{
            id: "browser-video-track",
            kind: "video",
            label: "browser test track",
            enabled: true,
            muted: false,
            readyState: "live",
            getSettings: () => ({ width: 1920 }),
            stop,
          }],
        } as unknown as MediaStream;
      },
    );
    const button = document.createElement("button");
    button.textContent = "Start camera";
    host.shadowRoot?.append(button);
    const input = { constraints: { video: { width: 640 } } };
    let invoked: Promise<unknown> | undefined;
    button.addEventListener("click", () => {
      invoked = broker.invoke("media.user.request", input);
    });

    await userEvent.click(button);
    const result = await invoked;

    expect(result).toMatchObject({
      ok: true,
      value: {
        resourceId: expect.stringMatching(/^user-media:/),
        tracks: [{ id: "browser-video-track", settings: { width: 1920 } }],
      },
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(input.constraints.video.width).toBe(640);

    await broker.destroy();
    expect(stop).toHaveBeenCalledOnce();
  });
});

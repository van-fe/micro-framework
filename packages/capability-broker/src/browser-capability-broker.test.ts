import type { CapabilityName } from "@micro-framework/contracts";
import { describe, expect, it, vi } from "vitest";
import { BrowserCapabilityBroker } from "./browser-capability-broker";

interface FakeWindowOptions {
  readonly active?: boolean;
  readonly permissionsPolicy?: { allowsFeature(feature: string): boolean };
  readonly permissionsQuery?: (descriptor: PermissionDescriptor) => Promise<PermissionStatus>;
  readonly mediaDevices?: MediaDevices;
}

function createHostWindow(options: FakeWindowOptions = {}): Window {
  return {
    DOMException,
    crypto: { randomUUID: () => "resource-id" },
    document: {
      baseURI: "https://host.test/",
      location: { origin: "https://host.test" },
      permissionsPolicy: options.permissionsPolicy,
    },
    navigator: {
      mediaDevices: options.mediaDevices,
      permissions: options.permissionsQuery ? { query: options.permissionsQuery } : undefined,
      userActivation: {
        hasBeenActive: options.active ?? true,
        isActive: options.active ?? true,
      },
    },
    structuredClone,
  } as unknown as Window;
}

function createBroker(
  allow: readonly CapabilityName[],
  windowOptions?: FakeWindowOptions,
): BrowserCapabilityBroker {
  return new BrowserCapabilityBroker({
    hostWindow: createHostWindow(windowOptions),
    applicationHost: { shadowRoot: null } as unknown as HTMLElement,
    allow,
  });
}

describe("BrowserCapabilityBroker", () => {
  it("denies privileged capabilities unless they are explicitly allowed", async () => {
    const broker = createBroker([]);

    await expect(broker.invoke("popup.open", { url: "/next" })).resolves.toEqual({
      ok: false,
      error: {
        code: "denied",
        message: "Capability is not allowed for this runtime: popup.open",
      },
    });
  });

  it("requires an active host user gesture for privileged capabilities", async () => {
    const broker = createBroker(["popup.open"], { active: false });

    await expect(broker.invoke("popup.open", { url: "/next" })).resolves.toMatchObject({
      ok: false,
      error: { code: "not-allowed" },
    });
  });

  it("rejects inputs that cannot cross a structured-clone boundary", async () => {
    const query = vi.fn();
    const broker = createBroker([], { permissionsQuery: query });

    await expect(broker.invoke("permissions.query", {
      name: "geolocation",
      callback: () => undefined,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-input" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports capabilities blocked by the host Permissions Policy", async () => {
    const broker = createBroker(["fullscreen.request"], {
      permissionsPolicy: { allowsFeature: (feature) => feature !== "fullscreen" },
    });

    await expect(broker.invoke("fullscreen.request")).resolves.toEqual({
      ok: false,
      error: {
        code: "policy-blocked",
        message: "Capability is blocked by Permissions Policy: fullscreen.",
      },
    });
  });

  it("maps host DOMException failures to stable capability errors", async () => {
    const broker = createBroker([], {
      permissionsQuery: async () => {
        throw new DOMException("Permission prompt rejected.", "NotAllowedError");
      },
    });

    await expect(broker.invoke("permissions.query", { name: "geolocation" })).resolves.toEqual({
      ok: false,
      error: { code: "not-allowed", message: "Permission prompt rejected." },
    });
  });

  it("clones media input and releases owned tracks during destroy", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      (constraints.video as MediaTrackConstraints).width = 1280;
      return {
        getTracks: () => [{
          id: "video-track",
          kind: "video",
          label: "test track",
          enabled: true,
          muted: false,
          readyState: "live",
          getSettings: () => ({ width: 1280 }),
          stop,
        }],
      } as unknown as MediaStream;
    });
    const broker = createBroker(["media.user.request"], {
      mediaDevices: { getUserMedia } as unknown as MediaDevices,
    });
    const input = { constraints: { video: { width: 640 } } };

    const result = await broker.invoke<{ resourceId: string }>("media.user.request", input);

    expect(result).toMatchObject({ ok: true, value: { resourceId: "user-media:resource-id" } });
    expect(input.constraints.video.width).toBe(640);
    await broker.destroy();
    expect(stop).toHaveBeenCalledOnce();
  });
});

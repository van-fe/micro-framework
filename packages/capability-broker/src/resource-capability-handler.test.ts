import { describe, expect, it, vi } from "vitest";
import { ResourceCapabilityHandler } from "./resource-capability-handler";

class FakeElement {
  readonly requestFullscreen = vi.fn(async () => undefined);
  readonly requestPointerLock = vi.fn(() => undefined);
}

class FakeMediaElement extends FakeElement {
  srcObject: MediaProvider | null = null;
}

class FakeVideoElement extends FakeMediaElement {
  readonly requestPictureInPicture = vi.fn(async () => ({ width: 640, height: 360 }));
}

interface ResourceEnvironment {
  applicationHost: HTMLElement & { requestFullscreen: ReturnType<typeof vi.fn> };
  document: Document & {
    fullscreenElement: Element | null;
    pictureInPictureElement: Element | null;
    pointerLockElement: Element | null;
  };
  elements: Map<string, FakeElement>;
  handler: ResourceCapabilityHandler;
  hostWindow: Window;
}

function createEnvironment(overrides: Record<string, unknown> = {}): ResourceEnvironment {
  const elements = new Map<string, FakeElement>();
  const exitFullscreen = vi.fn(async () => undefined);
  const exitPictureInPicture = vi.fn(async () => undefined);
  const exitPointerLock = vi.fn(() => undefined);
  const document = {
    baseURI: "https://host.test/root/",
    exitFullscreen,
    exitPictureInPicture,
    exitPointerLock,
    fullscreenElement: null,
    pictureInPictureElement: null,
    pointerLockElement: null,
  } as unknown as ResourceEnvironment["document"];
  const applicationHost = {
    requestFullscreen: vi.fn(async () => undefined),
    shadowRoot: {
      contains: (element: unknown) => [...elements.values()].includes(element as FakeElement),
      querySelector: (selector: string) => elements.get(selector) ?? null,
    },
  } as unknown as ResourceEnvironment["applicationHost"];
  let id = 0;
  const hostWindow = {
    Element: FakeElement,
    HTMLMediaElement: FakeMediaElement,
    HTMLVideoElement: FakeVideoElement,
    crypto: { randomUUID: () => `id-${++id}` },
    document,
    navigator: {},
    ...overrides,
  } as unknown as Window;
  return {
    applicationHost,
    document,
    elements,
    handler: new ResourceCapabilityHandler(hostWindow, applicationHost),
    hostWindow,
  };
}

function mediaStream(id: string): { stream: MediaStream; stop: ReturnType<typeof vi.fn> } {
  const stop = vi.fn();
  return {
    stop,
    stream: {
      getTracks: () => [{
        id,
        kind: "video",
        label: `${id} label`,
        enabled: true,
        muted: false,
        readyState: "live",
        getSettings: () => ({ width: 1280 }),
        stop,
      }],
    } as unknown as MediaStream,
  };
}

describe("resource capability handler", () => {
  it("owns, explicitly releases, and finally destroys user/display media", async () => {
    const user = mediaStream("user-track");
    const display = mediaStream("display-track");
    const getUserMedia = vi.fn(async () => user.stream);
    const getDisplayMedia = vi.fn(async () => display.stream);
    const environment = createEnvironment({
      navigator: { mediaDevices: { getDisplayMedia, getUserMedia } },
    });
    const preview = new FakeMediaElement();
    environment.elements.set("#preview", preview);

    const userResult = await environment.handler.invoke("media.user.request", {
      attachTo: "#preview",
      constraints: { video: true },
    });
    expect(userResult).toMatchObject({
      resourceId: "user-media:id-1",
      tracks: [{ id: "user-track", settings: { width: 1280 } }],
    });
    expect(preview.srcObject).toBe(user.stream);

    await expect(environment.handler.invoke("media.release", {
      resourceId: "user-media:id-1",
    })).resolves.toEqual({ released: true });
    expect(user.stop).toHaveBeenCalledOnce();
    expect(preview.srcObject).toBeNull();

    await expect(environment.handler.invoke("media.display.request", {
      constraints: { video: true },
    })).resolves.toMatchObject({ resourceId: "display-media:id-2" });
    await environment.handler.destroy();
    expect(display.stop).toHaveBeenCalledOnce();
  });

  it("routes fullscreen, pointer lock, and picture-in-picture to application elements", async () => {
    const environment = createEnvironment();
    const target = new FakeElement();
    const video = new FakeVideoElement();
    environment.elements.set("#target", target);
    environment.elements.set("#video", video);

    await expect(environment.handler.invoke("fullscreen.request", undefined))
      .resolves.toEqual({ fullscreen: true });
    await expect(environment.handler.invoke("pointer-lock.request", { selector: "#target" }))
      .resolves.toEqual({ locked: false });
    await expect(environment.handler.invoke("picture-in-picture.request", { selector: "#video" }))
      .resolves.toEqual({ active: true, width: 640, height: 360 });
    expect(environment.applicationHost.requestFullscreen).toHaveBeenCalledOnce();
    expect(target.requestPointerLock).toHaveBeenCalledOnce();
    expect(video.requestPictureInPicture).toHaveBeenCalledOnce();

    await expect(environment.handler.invoke("fullscreen.exit", undefined))
      .resolves.toEqual({ fullscreen: false });
    await expect(environment.handler.invoke("pointer-lock.exit", undefined))
      .resolves.toEqual({ locked: false });
    await expect(environment.handler.invoke("picture-in-picture.exit", undefined))
      .resolves.toEqual({ active: false });
    expect(environment.document.exitFullscreen).toHaveBeenCalledOnce();
    expect(environment.document.exitPointerLock).toHaveBeenCalledOnce();
    expect(environment.document.exitPictureInPicture).toHaveBeenCalledOnce();
  });

  it("releases wake locks explicitly and during final destroy", async () => {
    class Sentinel extends EventTarget {
      readonly type = "screen" as const;
      released = false;
      readonly release = vi.fn(async () => {
        this.released = true;
        this.dispatchEvent(new Event("release"));
      });
    }
    const first = new Sentinel();
    const second = new Sentinel();
    const request = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const environment = createEnvironment({ navigator: { wakeLock: { request } } });

    await expect(environment.handler.invoke("wake-lock.request", undefined))
      .resolves.toEqual({ resourceId: "wake-lock:id-1", type: "screen", released: false });
    await expect(environment.handler.invoke("wake-lock.release", { resourceId: "wake-lock:id-1" }))
      .resolves.toEqual({ released: true });
    await environment.handler.invoke("wake-lock.request", undefined);
    await environment.handler.destroy();

    expect(first.release).toHaveBeenCalledOnce();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it("completes successful payments and aborts pending requests on destroy", async () => {
    const complete = vi.fn(async () => undefined);
    const response = {
      complete,
      toJSON: () => ({ requestId: "payment-response" }),
    } as unknown as PaymentResponse;
    const created: Array<{ abort: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> }> = [];
    class PaymentRequestApi {
      readonly abort = vi.fn(async () => undefined);
      readonly show = vi.fn(async () => response);
      constructor(
        readonly methodData: readonly PaymentMethodData[],
        readonly details: PaymentDetailsInit,
        readonly options?: PaymentOptions,
      ) {
        created.push(this);
      }
    }
    const environment = createEnvironment({ PaymentRequest: PaymentRequestApi });

    const result = await environment.handler.invoke("payment.request", {
      details: { total: { label: "Total", amount: { currency: "USD", value: "1.00" } } },
      methodData: [{ supportedMethods: "basic-card" }],
    });
    expect(result).toEqual({
      resourceId: "payment:id-1",
      response: { requestId: "payment-response" },
    });
    await expect(environment.handler.invoke("payment.complete", {
      resourceId: "payment:id-1",
      result: "success",
    })).resolves.toEqual({ completed: true });
    expect(complete).toHaveBeenCalledWith("success");
    expect(created).toHaveLength(1);

    let rejectShow: ((error: Error) => void) | undefined;
    class PendingPaymentRequestApi {
      readonly abort = vi.fn(async () => rejectShow?.(new Error("payment aborted")));
      readonly show = vi.fn(() => new Promise<PaymentResponse>((_resolve, reject) => {
        rejectShow = reject;
      }));
    }
    const pendingEnvironment = createEnvironment({ PaymentRequest: PendingPaymentRequestApi });
    const pending = pendingEnvironment.handler.invoke("payment.request", {
      details: { total: { label: "Total", amount: { currency: "USD", value: "2.00" } } },
      methodData: [{ supportedMethods: "basic-card" }],
    });
    await Promise.resolve();
    await pendingEnvironment.handler.destroy();
    await expect(pending).rejects.toThrow("payment aborted");
  });

  it("closes owned notifications and popup windows during destroy", async () => {
    const notifications: FakeNotification[] = [];
    class FakeNotification extends EventTarget {
      static readonly permission = "granted";
      readonly tag: string;
      readonly close = vi.fn(() => this.dispatchEvent(new Event("close")));
      constructor(readonly title: string, options?: NotificationOptions) {
        super();
        this.tag = options?.tag ?? "";
        notifications.push(this);
      }
    }
    const popupState = {
      closed: false,
      close: vi.fn(() => { popupState.closed = true; }),
    };
    const popup = popupState as unknown as Window;
    const open = vi.fn(() => popup);
    const environment = createEnvironment({ Notification: FakeNotification, open });

    await expect(environment.handler.invoke("notification.show", {
      options: { tag: "orders" },
      title: "Order ready",
    })).resolves.toEqual({ shown: true, tag: "orders" });
    await expect(environment.handler.invoke("popup.open", {
      target: "orders-window",
      url: "../orders/42",
    })).resolves.toEqual({ opened: true });
    expect(open).toHaveBeenCalledWith(
      new URL("https://host.test/orders/42"),
      "orders-window",
      undefined,
    );

    await environment.handler.destroy();
    expect(notifications[0]?.close).toHaveBeenCalledOnce();
    expect(popupState.close).toHaveBeenCalledOnce();
  });
});

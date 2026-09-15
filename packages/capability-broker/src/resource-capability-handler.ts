import type { CapabilityResult } from "@micro-framework/contracts";
import type { NotificationConstructor, PaymentRequestConstructor } from "./browser-api-types";
import type { ResourceCapabilityName } from "./capability-ownership";
import { failure } from "./capability-result";
import { optionalString, requireObject, requireString } from "./input-validation";

interface MediaResource {
  readonly stream: MediaStream;
  readonly element?: HTMLMediaElement;
}

function describeTrack(track: MediaStreamTrack): Record<string, unknown> {
  return {
    id: track.id,
    kind: track.kind,
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings(),
  };
}

export class ResourceCapabilityHandler {
  readonly #hostWindow: Window;
  readonly #applicationHost: HTMLElement;
  readonly #media = new Map<string, MediaResource>();
  readonly #wakeLocks = new Map<string, WakeLockSentinel>();
  readonly #paymentRequests = new Map<string, PaymentRequest>();
  readonly #paymentResponses = new Map<string, PaymentResponse>();
  readonly #notifications = new Set<Notification>();
  readonly #popups = new Set<Window>();
  #sequence = 0;

  constructor(hostWindow: Window, applicationHost: HTMLElement) {
    this.#hostWindow = hostWindow;
    this.#applicationHost = applicationHost;
  }

  async invoke(
    name: ResourceCapabilityName,
    input: unknown,
  ): Promise<unknown | CapabilityResult<never>> {
    switch (name) {
      case "fullscreen.request": {
        const request = input === undefined ? {} : requireObject(input, name);
        const selector = optionalString(request, "selector", name);
        const target = selector ? this.#element(selector, "Element", name) : this.#applicationHost;
        if (!target.requestFullscreen) return failure("not-available", "Fullscreen API is not available.");
        await target.requestFullscreen();
        return { fullscreen: true };
      }
      case "fullscreen.exit":
        if (!this.#hostWindow.document.exitFullscreen) {
          return failure("not-available", "Fullscreen API is not available.");
        }
        await this.#hostWindow.document.exitFullscreen();
        return { fullscreen: false };
      case "media.user.request":
        return this.#requestMedia(name, input, false);
      case "media.display.request":
        return this.#requestMedia(name, input, true);
      case "media.release": {
        const resourceId = requireString(requireObject(input, name), "resourceId", name);
        const resource = this.#media.get(resourceId);
        if (!resource) throw new TypeError(`Unknown media resource: ${resourceId}.`);
        this.#releaseMedia(resourceId, resource);
        return { released: true };
      }
      case "picture-in-picture.request": {
        const selector = requireString(requireObject(input, name), "selector", name);
        const video = this.#element(selector, "HTMLVideoElement", name);
        if (!video.requestPictureInPicture) {
          return failure("not-available", "Picture-in-Picture API is not available.");
        }
        const picture = await video.requestPictureInPicture();
        return { active: true, width: picture.width, height: picture.height };
      }
      case "picture-in-picture.exit":
        if (!this.#hostWindow.document.exitPictureInPicture) {
          return failure("not-available", "Picture-in-Picture API is not available.");
        }
        await this.#hostWindow.document.exitPictureInPicture();
        return { active: false };
      case "wake-lock.request": {
        if (!this.#hostWindow.navigator.wakeLock) {
          return failure("not-available", "Screen Wake Lock API is not available.");
        }
        const sentinel = await this.#hostWindow.navigator.wakeLock.request("screen");
        const resourceId = this.#id("wake-lock");
        this.#wakeLocks.set(resourceId, sentinel);
        sentinel.addEventListener("release", () => this.#wakeLocks.delete(resourceId), { once: true });
        return { resourceId, type: sentinel.type, released: sentinel.released };
      }
      case "wake-lock.release": {
        const resourceId = requireString(requireObject(input, name), "resourceId", name);
        const sentinel = this.#wakeLocks.get(resourceId);
        if (!sentinel) throw new TypeError(`Unknown wake-lock resource: ${resourceId}.`);
        await sentinel.release();
        this.#wakeLocks.delete(resourceId);
        return { released: true };
      }
      case "pointer-lock.request": {
        const request = requireObject(input, name);
        const selector = requireString(request, "selector", name);
        const target = this.#element(selector, "Element", name);
        if (!target.requestPointerLock) {
          return failure("not-available", "Pointer Lock API is not available.");
        }
        await target.requestPointerLock(request.options as PointerLockOptions | undefined);
        return { locked: this.#hostWindow.document.pointerLockElement === target };
      }
      case "pointer-lock.exit":
        if (!this.#hostWindow.document.exitPointerLock) {
          return failure("not-available", "Pointer Lock API is not available.");
        }
        this.#hostWindow.document.exitPointerLock();
        return { locked: false };
      case "payment.request":
        return this.#requestPayment(input);
      case "payment.complete": {
        const request = requireObject(input, name);
        const resourceId = requireString(request, "resourceId", name);
        const response = this.#paymentResponses.get(resourceId);
        if (!response) throw new TypeError(`Unknown payment resource: ${resourceId}.`);
        const result = request.result as PaymentComplete | undefined;
        await response.complete(result);
        this.#paymentResponses.delete(resourceId);
        return { completed: true };
      }
      case "notification.show": {
        const request = requireObject(input, name);
        const title = requireString(request, "title", name);
        const NotificationApi = Reflect.get(this.#hostWindow, "Notification") as
          | NotificationConstructor
          | undefined;
        if (!NotificationApi) return failure("not-available", "Notifications API is not available.");
        if (NotificationApi.permission !== "granted") {
          return failure("not-allowed", "Notification permission has not been granted.");
        }
        const notification = new NotificationApi(
          title,
          (request.options ?? undefined) as NotificationOptions | undefined,
        );
        this.#notifications.add(notification);
        notification.addEventListener("close", () => this.#notifications.delete(notification), { once: true });
        return { shown: true, tag: notification.tag };
      }
      case "popup.open": {
        const request = requireObject(input, name);
        const url = requireString(request, "url", name);
        const target = optionalString(request, "target", name) ?? "_blank";
        const features = optionalString(request, "features", name);
        const opened = this.#hostWindow.open(
          new URL(url, this.#hostWindow.document.baseURI),
          target,
          features,
        );
        if (opened && opened !== this.#hostWindow) this.#popups.add(opened);
        return { opened: opened !== null };
      }
    }
  }

  async destroy(): Promise<void> {
    for (const [resourceId, resource] of this.#media) this.#releaseMedia(resourceId, resource);
    await Promise.allSettled([...this.#wakeLocks.values()].map((sentinel) => sentinel.release()));
    this.#wakeLocks.clear();
    await Promise.allSettled([...this.#paymentRequests.values()].map((request) => request.abort()));
    this.#paymentRequests.clear();
    await Promise.allSettled([...this.#paymentResponses.values()].map((response) => response.complete("fail")));
    this.#paymentResponses.clear();
    for (const notification of this.#notifications) notification.close();
    this.#notifications.clear();
    for (const popup of this.#popups) {
      if (!popup.closed) popup.close();
    }
    this.#popups.clear();

    const shadowRoot = this.#applicationHost.shadowRoot;
    const document = this.#hostWindow.document;
    if (document.pointerLockElement && shadowRoot?.contains(document.pointerLockElement)) {
      document.exitPointerLock();
    }
    if (document.pictureInPictureElement && shadowRoot?.contains(document.pictureInPictureElement)) {
      await document.exitPictureInPicture().catch(() => undefined);
    }
    if (document.fullscreenElement && (
      document.fullscreenElement === this.#applicationHost
      || shadowRoot?.contains(document.fullscreenElement)
    )) {
      await document.exitFullscreen().catch(() => undefined);
    }
  }

  async #requestMedia(
    name: "media.user.request" | "media.display.request",
    input: unknown,
    display: boolean,
  ): Promise<unknown> {
    const request = requireObject(input, name);
    const mediaDevices = this.#hostWindow.navigator.mediaDevices;
    if (!mediaDevices) return failure("not-available", "Media Devices API is not available.");
    const constraints = request.constraints as MediaStreamConstraints | DisplayMediaStreamOptions | undefined;
    const stream = display
      ? await mediaDevices.getDisplayMedia(constraints as DisplayMediaStreamOptions | undefined)
      : await mediaDevices.getUserMedia(constraints as MediaStreamConstraints | undefined);
    const attachTo = optionalString(request, "attachTo", name);
    const element = attachTo ? this.#element(attachTo, "HTMLMediaElement", name) : undefined;
    if (element) element.srcObject = stream;
    const resourceId = this.#id(display ? "display-media" : "user-media");
    this.#media.set(resourceId, { stream, element });
    return { resourceId, tracks: stream.getTracks().map(describeTrack) };
  }

  async #requestPayment(input: unknown): Promise<unknown | CapabilityResult<never>> {
    const request = requireObject(input, "payment.request");
    const PaymentRequestApi = Reflect.get(this.#hostWindow, "PaymentRequest") as
      | PaymentRequestConstructor
      | undefined;
    if (!PaymentRequestApi) return failure("not-available", "Payment Request API is not available.");
    if (!Array.isArray(request.methodData) || !request.details || typeof request.details !== "object") {
      throw new TypeError("payment.request requires methodData and details fields.");
    }
    const payment = new PaymentRequestApi(
      request.methodData as PaymentMethodData[],
      request.details as PaymentDetailsInit,
      request.options as PaymentOptions | undefined,
    );
    const resourceId = this.#id("payment");
    this.#paymentRequests.set(resourceId, payment);
    try {
      const response = await payment.show();
      this.#paymentRequests.delete(resourceId);
      this.#paymentResponses.set(resourceId, response);
      return { resourceId, response: response.toJSON() };
    } catch (error) {
      this.#paymentRequests.delete(resourceId);
      throw error;
    }
  }

  #element<T extends "Element" | "HTMLMediaElement" | "HTMLVideoElement">(
    selector: string,
    constructorName: T,
    capability: string,
  ): T extends "HTMLVideoElement" ? HTMLVideoElement
    : T extends "HTMLMediaElement" ? HTMLMediaElement
      : Element {
    const constructor = Reflect.get(this.#hostWindow, constructorName) as typeof Element;
    const element = this.#applicationHost.shadowRoot?.querySelector(selector);
    if (!(element instanceof constructor)) {
      throw new TypeError(`${capability} could not find a compatible application element: ${selector}.`);
    }
    return element as never;
  }

  #id(prefix: string): string {
    const crypto = this.#hostWindow.crypto;
    return `${prefix}:${crypto.randomUUID?.() ?? ++this.#sequence}`;
  }

  #releaseMedia(resourceId: string, resource: MediaResource): void {
    for (const track of resource.stream.getTracks()) track.stop();
    if (resource.element?.srcObject === resource.stream) resource.element.srcObject = null;
    this.#media.delete(resourceId);
  }
}

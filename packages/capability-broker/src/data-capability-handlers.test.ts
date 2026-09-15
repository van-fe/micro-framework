import { describe, expect, it, vi } from "vitest";
import { capabilityOwners } from "./capability-ownership";
import { invokeDataCapability } from "./data-capability-handlers";

function hostWindow(properties: Record<string, unknown> = {}): Window {
  return {
    navigator: {},
    ...properties,
  } as unknown as Window;
}

describe("data capability handlers", () => {
  it("keeps an exhaustive owner for every public capability", () => {
    expect(Object.keys(capabilityOwners)).toHaveLength(27);
    expect(Object.values(capabilityOwners).filter((owner) => owner === "data")).toHaveLength(12);
    expect(Object.values(capabilityOwners).filter((owner) => owner === "resource")).toHaveLength(15);
  });

  it("queries host user activation and permission state", async () => {
    const query = vi.fn(async () => ({ state: "prompt" }) as PermissionStatus);
    const window = hostWindow({
      navigator: {
        permissions: { query },
        userActivation: { hasBeenActive: true, isActive: false },
      },
    });

    await expect(invokeDataCapability(window, "user-activation.query", undefined))
      .resolves.toEqual({ hasBeenActive: true, isActive: false });
    await expect(invokeDataCapability(window, "permissions.query", { name: "geolocation" }))
      .resolves.toEqual({ state: "prompt" });
    expect(query).toHaveBeenCalledWith({ name: "geolocation" });
  });

  it("reads and writes text through the host clipboard", async () => {
    const readText = vi.fn(async () => "host clipboard");
    const writeText = vi.fn(async () => undefined);
    const window = hostWindow({ navigator: { clipboard: { readText, writeText } } });

    await expect(invokeDataCapability(window, "clipboard.read-text", undefined))
      .resolves.toEqual({ text: "host clipboard" });
    await expect(invokeDataCapability(window, "clipboard.write-text", { text: "next" }))
      .resolves.toEqual({ written: true });
    expect(writeText).toHaveBeenCalledWith("next");
  });

  it("invokes all three host file pickers with their original options", async () => {
    const openHandle = { kind: "file", name: "open.txt" } as FileSystemFileHandle;
    const saveHandle = { kind: "file", name: "save.txt" } as FileSystemFileHandle;
    const directoryHandle = { kind: "directory", name: "exports" } as FileSystemDirectoryHandle;
    const showOpenFilePicker = vi.fn(async () => [openHandle]);
    const showSaveFilePicker = vi.fn(async () => saveHandle);
    const showDirectoryPicker = vi.fn(async () => directoryHandle);
    const window = hostWindow({ showOpenFilePicker, showSaveFilePicker, showDirectoryPicker });
    const options = { multiple: true };

    await expect(invokeDataCapability(window, "file-picker.open", options))
      .resolves.toEqual({ handles: [openHandle] });
    await expect(invokeDataCapability(window, "file-picker.save", options))
      .resolves.toEqual({ handle: saveHandle });
    await expect(invokeDataCapability(window, "file-picker.directory", options))
      .resolves.toEqual({ handle: directoryHandle });
    expect(showOpenFilePicker).toHaveBeenCalledWith(options);
    expect(showSaveFilePicker).toHaveBeenCalledWith(options);
    expect(showDirectoryPicker).toHaveBeenCalledWith(options);
  });

  it("serializes WebAuthn create/get results without leaking credential instances", async () => {
    const create = vi.fn(async () => ({
      id: "created-id",
      type: "public-key",
      toJSON: () => ({ id: "created-id", response: { attestationObject: "encoded" } }),
    }));
    const get = vi.fn(async () => ({ id: "assertion-id", type: "public-key" }));
    const window = hostWindow({ navigator: { credentials: { create, get } } });
    const createOptions = { publicKey: { challenge: new Uint8Array([1]) } };
    const getOptions = { publicKey: { challenge: new Uint8Array([2]) } };

    await expect(invokeDataCapability(window, "webauthn.create", createOptions))
      .resolves.toEqual({ credential: { id: "created-id", response: { attestationObject: "encoded" } } });
    await expect(invokeDataCapability(window, "webauthn.get", getOptions))
      .resolves.toEqual({ credential: { id: "assertion-id", type: "public-key" } });
    expect(create).toHaveBeenCalledWith(createOptions);
    expect(get).toHaveBeenCalledWith(getOptions);
  });

  it("validates Web Share data and requests notification permission", async () => {
    const share = vi.fn(async () => undefined);
    const canShare = vi.fn((data: ShareData) => data.title !== "blocked");
    const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    const window = hostWindow({
      Notification: { requestPermission },
      navigator: { canShare, share },
    });

    await expect(invokeDataCapability(window, "share.open", { title: "blocked" }))
      .resolves.toMatchObject({ ok: false, error: { code: "invalid-input" } });
    await expect(invokeDataCapability(window, "share.open", { title: "allowed" }))
      .resolves.toEqual({ shared: true });
    await expect(invokeDataCapability(window, "notification.request-permission", undefined))
      .resolves.toEqual({ permission: "granted" });
    expect(share).toHaveBeenCalledWith({ title: "allowed" });
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("returns stable not-available results when optional host APIs are absent", async () => {
    const window = hostWindow();

    for (const [name, input] of [
      ["clipboard.read-text", undefined],
      ["clipboard.write-text", { text: "next" }],
      ["file-picker.open", {}],
      ["file-picker.save", {}],
      ["file-picker.directory", {}],
      ["webauthn.create", {}],
      ["share.open", { title: "missing" }],
      ["notification.request-permission", undefined],
    ] as const) {
      await expect(invokeDataCapability(window, name, input))
        .resolves.toMatchObject({ ok: false, error: { code: "not-available" } });
    }
  });
});

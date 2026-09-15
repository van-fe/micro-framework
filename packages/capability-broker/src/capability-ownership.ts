import type { CapabilityName } from "@micro-framework/contracts";

export const capabilityOwners = {
  "environment.features": "data",
  "user-activation.query": "data",
  "permissions.query": "data",
  "clipboard.read-text": "data",
  "clipboard.write-text": "data",
  "file-picker.open": "data",
  "file-picker.save": "data",
  "file-picker.directory": "data",
  "webauthn.create": "data",
  "webauthn.get": "data",
  "share.open": "data",
  "notification.request-permission": "data",
  "media.user.request": "resource",
  "media.display.request": "resource",
  "media.release": "resource",
  "picture-in-picture.request": "resource",
  "picture-in-picture.exit": "resource",
  "wake-lock.request": "resource",
  "wake-lock.release": "resource",
  "pointer-lock.request": "resource",
  "pointer-lock.exit": "resource",
  "payment.request": "resource",
  "payment.complete": "resource",
  "notification.show": "resource",
  "fullscreen.request": "resource",
  "fullscreen.exit": "resource",
  "popup.open": "resource",
} as const satisfies Record<CapabilityName, "data" | "resource">;

export type DataCapabilityName = {
  [Name in CapabilityName]: typeof capabilityOwners[Name] extends "data" ? Name : never;
}[CapabilityName];

export type ResourceCapabilityName = Exclude<CapabilityName, DataCapabilityName>;

export function isDataCapability(name: CapabilityName): name is DataCapabilityName {
  return capabilityOwners[name] === "data";
}

export type CapabilityName =
  | "environment.features"
  | "user-activation.query"
  | "permissions.query"
  | "clipboard.read-text"
  | "clipboard.write-text"
  | "file-picker.open"
  | "file-picker.save"
  | "file-picker.directory"
  | "webauthn.create"
  | "webauthn.get"
  | "share.open"
  | "media.user.request"
  | "media.display.request"
  | "media.release"
  | "picture-in-picture.request"
  | "picture-in-picture.exit"
  | "wake-lock.request"
  | "wake-lock.release"
  | "pointer-lock.request"
  | "pointer-lock.exit"
  | "payment.request"
  | "payment.complete"
  | "notification.request-permission"
  | "notification.show"
  | "fullscreen.request"
  | "fullscreen.exit"
  | "popup.open";

export type CapabilityErrorCode =
  | "denied"
  | "invalid-input"
  | "not-available"
  | "not-allowed"
  | "policy-blocked"
  | "aborted"
  | "operation-failed";

export type CapabilityResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: {
        code: CapabilityErrorCode;
        message: string;
      };
    };

export interface RuntimeCapabilities {
  invoke<T = unknown>(name: CapabilityName, input?: unknown): Promise<CapabilityResult<T>>;
}

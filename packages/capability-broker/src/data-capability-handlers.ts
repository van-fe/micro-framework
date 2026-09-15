import type { CapabilityResult } from "@micro-framework/contracts";
import type { FilePickerWindow, NotificationConstructor } from "./browser-api-types";
import type { DataCapabilityName } from "./capability-ownership";
import { detectBrowserFeatures } from "./browser-features";
import { failure } from "./capability-result";
import { requireObject, requireString } from "./input-validation";

function filePickerWindow(hostWindow: Window): FilePickerWindow {
  return hostWindow as FilePickerWindow;
}

function notificationConstructor(hostWindow: Window): NotificationConstructor | undefined {
  return Reflect.get(hostWindow, "Notification") as NotificationConstructor | undefined;
}

export async function invokeDataCapability(
  hostWindow: Window,
  name: DataCapabilityName,
  input: unknown,
): Promise<unknown | CapabilityResult<never>> {
  switch (name) {
    case "environment.features":
      return detectBrowserFeatures(hostWindow);
    case "user-activation.query":
      return {
        isActive: hostWindow.navigator.userActivation?.isActive ?? false,
        hasBeenActive: hostWindow.navigator.userActivation?.hasBeenActive ?? false,
      };
    case "permissions.query": {
      const request = requireObject(input, name);
      const permissionName = requireString(request, "name", name);
      if (!hostWindow.navigator.permissions) {
        return failure("not-available", "Permissions API is not available.");
      }
      const status = await hostWindow.navigator.permissions.query(
        { ...request, name: permissionName } as PermissionDescriptor,
      );
      return { state: status.state };
    }
    case "clipboard.read-text":
      if (!hostWindow.navigator.clipboard?.readText) {
        return failure("not-available", "Clipboard read API is not available.");
      }
      return { text: await hostWindow.navigator.clipboard.readText() };
    case "clipboard.write-text": {
      const request = requireObject(input, name);
      const text = requireString(request, "text", name);
      if (!hostWindow.navigator.clipboard?.writeText) {
        return failure("not-available", "Clipboard write API is not available.");
      }
      await hostWindow.navigator.clipboard.writeText(text);
      return { written: true };
    }
    case "file-picker.open": {
      const picker = filePickerWindow(hostWindow).showOpenFilePicker;
      if (!picker) return failure("not-available", "Open File Picker is not available.");
      return { handles: await picker.call(hostWindow, input) };
    }
    case "file-picker.save": {
      const picker = filePickerWindow(hostWindow).showSaveFilePicker;
      if (!picker) return failure("not-available", "Save File Picker is not available.");
      return { handle: await picker.call(hostWindow, input) };
    }
    case "file-picker.directory": {
      const picker = filePickerWindow(hostWindow).showDirectoryPicker;
      if (!picker) return failure("not-available", "Directory Picker is not available.");
      return { handle: await picker.call(hostWindow, input) };
    }
    case "webauthn.create":
    case "webauthn.get": {
      const request = requireObject(input, name);
      if (!hostWindow.navigator.credentials) {
        return failure("not-available", "Credential Management API is not available.");
      }
      const credential = name === "webauthn.create"
        ? await hostWindow.navigator.credentials.create(request as CredentialCreationOptions)
        : await hostWindow.navigator.credentials.get(request as CredentialRequestOptions);
      if (!credential) return { credential: null };
      const publicKeyCredential = credential as PublicKeyCredential;
      return {
        credential: typeof publicKeyCredential.toJSON === "function"
          ? publicKeyCredential.toJSON()
          : { id: credential.id, type: credential.type },
      };
    }
    case "share.open": {
      const request = requireObject(input, name) as ShareData;
      if (!hostWindow.navigator.share) {
        return failure("not-available", "Web Share API is not available.");
      }
      if (hostWindow.navigator.canShare && !hostWindow.navigator.canShare(request)) {
        return failure("invalid-input", "The supplied share data is not supported.");
      }
      await hostWindow.navigator.share(request);
      return { shared: true };
    }
    case "notification.request-permission": {
      const NotificationApi = notificationConstructor(hostWindow);
      if (!NotificationApi) return failure("not-available", "Notifications API is not available.");
      return { permission: await NotificationApi.requestPermission() };
    }
  }
}

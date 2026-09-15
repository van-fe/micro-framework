import type { CapabilityName } from "@micro-framework/contracts";

interface PermissionsPolicyLike {
  allowsFeature(feature: string, origin?: string): boolean;
}

const SAFE_CAPABILITIES = new Set<CapabilityName>([
  "environment.features",
  "user-activation.query",
  "permissions.query",
]);

const ACTIVATION_REQUIRED = new Set<CapabilityName>([
  "clipboard.read-text",
  "clipboard.write-text",
  "file-picker.open",
  "file-picker.save",
  "file-picker.directory",
  "webauthn.create",
  "webauthn.get",
  "share.open",
  "media.user.request",
  "media.display.request",
  "picture-in-picture.request",
  "wake-lock.request",
  "pointer-lock.request",
  "payment.request",
  "notification.request-permission",
  "notification.show",
  "fullscreen.request",
  "popup.open",
]);

const POLICY_FEATURES: Partial<Record<CapabilityName, readonly string[]>> = {
  "clipboard.read-text": ["clipboard-read"],
  "clipboard.write-text": ["clipboard-write"],
  "webauthn.create": ["publickey-credentials-create"],
  "webauthn.get": ["publickey-credentials-get"],
  "share.open": ["web-share"],
  "media.display.request": ["display-capture"],
  "picture-in-picture.request": ["picture-in-picture"],
  "wake-lock.request": ["screen-wake-lock"],
  "payment.request": ["payment"],
  "fullscreen.request": ["fullscreen"],
};

export function defaultAllowedCapabilities(): ReadonlySet<CapabilityName> {
  return SAFE_CAPABILITIES;
}

export function requiresUserActivation(name: CapabilityName): boolean {
  return ACTIVATION_REQUIRED.has(name);
}

function mediaPolicyFeatures(input: unknown): string[] {
  const constraints = (input as { constraints?: MediaStreamConstraints } | undefined)?.constraints;
  const features: string[] = [];
  if (constraints?.video) features.push("camera");
  if (constraints?.audio) features.push("microphone");
  return features;
}

export function blockedPolicyFeatures(
  hostDocument: Document,
  name: CapabilityName,
  input: unknown,
): string[] {
  const documentRecord = hostDocument as Document & {
    permissionsPolicy?: PermissionsPolicyLike;
    featurePolicy?: PermissionsPolicyLike;
  };
  const policy = documentRecord.permissionsPolicy ?? documentRecord.featurePolicy;
  if (!policy) return [];
  const features = name === "media.user.request"
    ? mediaPolicyFeatures(input)
    : [...(POLICY_FEATURES[name] ?? [])];
  return features.filter((feature) => {
    try {
      return !policy.allowsFeature(feature, hostDocument.location?.origin);
    } catch {
      return false;
    }
  });
}

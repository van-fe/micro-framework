import type {
  CapabilityErrorCode,
  CapabilityName,
  CapabilityResult,
  RuntimeCapabilities,
} from "@micro-framework/contracts";
import {
  blockedPolicyFeatures,
  defaultAllowedCapabilities,
  requiresUserActivation,
} from "./capability-policy";
import { isDataCapability } from "./capability-ownership";
import { failure, isFailure, messageOf } from "./capability-result";
import { invokeDataCapability } from "./data-capability-handlers";
import { ResourceCapabilityHandler } from "./resource-capability-handler";

export interface BrowserCapabilityBrokerOptions {
  hostWindow: Window;
  applicationHost: HTMLElement;
  allow?: readonly CapabilityName[];
}

function domExceptionCode(error: DOMException): CapabilityErrorCode {
  if (error.name === "AbortError" || error.name === "NotFoundError") return "aborted";
  if (error.name === "NotAllowedError") return "not-allowed";
  if (error.name === "SecurityError") return "policy-blocked";
  return "operation-failed";
}

function asDomException(hostWindow: Window, error: unknown): DOMException | undefined {
  const HostDOMException = Reflect.get(hostWindow, "DOMException") as typeof DOMException | undefined;
  return HostDOMException && error instanceof HostDOMException ? error : undefined;
}

export class BrowserCapabilityBroker implements RuntimeCapabilities {
  readonly #hostWindow: Window;
  readonly #allowed: ReadonlySet<CapabilityName>;
  readonly #resources: ResourceCapabilityHandler;

  constructor(options: BrowserCapabilityBrokerOptions) {
    this.#hostWindow = options.hostWindow;
    this.#allowed = new Set([
      ...defaultAllowedCapabilities(),
      ...(options.allow ?? []),
    ]);
    this.#resources = new ResourceCapabilityHandler(options.hostWindow, options.applicationHost);
  }

  async invoke<T = unknown>(name: CapabilityName, input?: unknown): Promise<CapabilityResult<T>> {
    if (!this.#allowed.has(name)) {
      return failure("denied", `Capability is not allowed for this runtime: ${name}`);
    }
    if (requiresUserActivation(name)
      && this.#hostWindow.navigator.userActivation?.isActive !== true) {
      return failure("not-allowed", `Capability requires active host user activation: ${name}`);
    }

    try {
      const clonedInput = input === undefined
        ? undefined
        : this.#hostWindow.structuredClone(input);
      const blocked = blockedPolicyFeatures(
        this.#hostWindow.document,
        name,
        clonedInput,
      );
      if (blocked.length > 0) {
        return failure(
          "policy-blocked",
          `Capability is blocked by Permissions Policy: ${blocked.join(", ")}.`,
        );
      }

      const result = isDataCapability(name)
        ? await invokeDataCapability(this.#hostWindow, name, clonedInput)
        : await this.#resources.invoke(name, clonedInput);
      if (isFailure(result)) return result;
      return {
        ok: true,
        value: this.#hostWindow.structuredClone(result) as T,
      };
    } catch (error) {
      const domException = asDomException(this.#hostWindow, error);
      if (error instanceof TypeError || domException?.name === "DataCloneError") {
        return failure("invalid-input", messageOf(error));
      }
      if (domException) return failure(domExceptionCode(domException), messageOf(error));
      return failure("operation-failed", messageOf(error));
    }
  }

  destroy(): Promise<void> {
    return this.#resources.destroy();
  }
}

import type { AppProps, RuntimeStorage, RuntimeServices, RuntimeEvents, RuntimeCapabilities } from "@micro-framework/contracts";
import { BrowserCapabilityBroker } from "@micro-framework/capability-broker";
import { createRuntimeChannel } from "@micro-framework/channel";
import type { DomSurface } from "@micro-framework/dom-surface";
import type { ManagedResourceScope } from "../infrastructure/resource-scope";
import type { ApplicationRuntimePort } from "./runtime-port";

interface ApplicationContextOptions<Props extends object> {
  name: string;
  instanceId: string;
  businessProps: Props;
  runtime: ApplicationRuntimePort;
  storage: RuntimeStorage;
  resources: ManagedResourceScope;
  signal: AbortSignal;
  container: HTMLElement;
  surface?: DomSurface;
}

/** Owns application service/resource wiring; lifecycle transitions stay in AppController. */
export function createApplicationContext<Props extends object>(options: ApplicationContextOptions<Props>): AppProps<Props> {
  const { name, instanceId, businessProps, runtime, storage, resources, signal, container, surface } = options;
  let services: RuntimeServices = runtime.services;
  let events: RuntimeEvents = runtime.events;
  let capabilities: RuntimeCapabilities = {
    invoke: async () => ({
      ok: false as const,
      error: { code: "denied" as const, message: "Host capabilities are not exposed to a strong isolation iframe." },
    }),
  };
  if (surface) {
    const hostWindow = surface.host.ownerDocument.defaultView!;
    const broker = new BrowserCapabilityBroker({ hostWindow, applicationHost: surface.host, allow: runtime.capabilityAllowlist });
    resources.add(() => broker.destroy());
    const channel = createRuntimeChannel({
      hostWindow, services: runtime.services, events: runtime.events,
      onError: (error) => runtime.reportError({ name, phase: "channel", error }),
    });
    resources.add(() => channel.destroy());
    services = channel.services;
    events = channel.events;
    capabilities = broker;
  }
  return Object.assign({}, businessProps, {
    name,
    container: surface?.body ?? container,
    overlayContainer: surface?.overlay ?? container,
    $runtime: Object.freeze({ name, instanceId, signal, services, events, storage, resources, capabilities }),
  });
}

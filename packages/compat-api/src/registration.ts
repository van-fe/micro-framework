import type {
  AppHandle,
  AppRegistration,
  LifecycleEvent,
  MaybePromise,
  RuntimeHooks,
} from "@micro-framework/contracts";
import { getDefaultRuntime } from "./default-runtime";

export interface CompatibleAppRegistration<Props extends object = Record<string, unknown>>
  extends Omit<AppRegistration<Props>, "activeWhen"> {
  activeRule?: AppRegistration<Props>["activeWhen"];
}

export type CompatibleLifecycleHook = (
  application: CompatibleAppRegistration,
) => MaybePromise<void>;

export interface CompatibleRuntimeHooks {
  beforeLoad?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
  afterLoad?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
  beforeMount?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
  afterMount?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
  beforeUnmount?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
  afterUnmount?: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[];
}

function hookArray(
  hook: CompatibleLifecycleHook | readonly CompatibleLifecycleHook[] | undefined,
): readonly CompatibleLifecycleHook[] {
  if (!hook) return [];
  return Array.isArray(hook) ? hook : [hook as CompatibleLifecycleHook];
}

export function adaptCompatibleHooks(
  hooks: CompatibleRuntimeHooks | undefined,
  applications: readonly CompatibleAppRegistration[],
): RuntimeHooks | undefined {
  if (!hooks) return undefined;
  const applicationsByName = new Map(applications.map((application) => [application.name, application]));
  const adapt = (hook: CompatibleRuntimeHooks[keyof CompatibleRuntimeHooks]) =>
    async (event: LifecycleEvent) => {
      const application = applicationsByName.get(event.name);
      if (!application) return;
      for (const operation of hookArray(hook)) await operation(application);
    };

  return {
    beforeLoad: adapt(hooks.beforeLoad),
    afterLoad: adapt(hooks.afterLoad),
    beforeMount: adapt(hooks.beforeMount),
    afterMount: adapt(hooks.afterMount),
    beforeUnmount: adapt(hooks.beforeUnmount),
    afterUnmount: adapt(hooks.afterUnmount),
  };
}

export function registerMicroApps(
  applications: readonly CompatibleAppRegistration[],
  hooks?: CompatibleRuntimeHooks,
): void {
  getDefaultRuntime().registerApps(
    applications.map(({ activeRule, ...application }) => ({ ...application, activeWhen: activeRule })),
    adaptCompatibleHooks(hooks, applications),
  );
}

export function start(options: { prefetch?: boolean | "all"; singular?: boolean } = {}): Promise<void> {
  return getDefaultRuntime().start({
    preload: options.prefetch ?? true,
    concurrency: options.singular ? "single" : "multiple",
  });
}

export function loadMicroApp<Props extends object>(
  application: CompatibleAppRegistration<Props>,
): Promise<AppHandle<Props>> {
  const { activeRule: _activeRule, ...registration } = application;
  return getDefaultRuntime().mountApp(registration);
}

export async function prefetchApps(
  applications: readonly (CompatibleAppRegistration | string)[],
): Promise<void> {
  await getDefaultRuntime().preloadApps(applications.map((application) => ({
    ...(typeof application === "string" ? {} : { name: application.name }),
    entry: typeof application === "string" ? application : application.entry,
  })));
}

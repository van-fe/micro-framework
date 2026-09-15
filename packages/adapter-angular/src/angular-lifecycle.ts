import { createComponent, provideZonelessChangeDetection, type ApplicationRef, type ComponentRef, type EnvironmentProviders, type Provider, type Type } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import type { AppProps, LifecycleFunction } from "@micro-framework/contracts";

export interface AngularLifecycleOptions<Component, Props extends object> {
  readonly component: Type<Component>;
  readonly providers?: readonly (Provider | EnvironmentProviders)[];
  readonly inputs?: (props: AppProps<Props>) => Record<string, unknown>;
}
export interface AngularLifecycle<Props extends object> {
  mount: LifecycleFunction<Props>;
  update: LifecycleFunction<Props>;
  unmount: LifecycleFunction<Props>;
}

/** Accepts AOT-compiled standalone components; execution stays in the application's iframe. */
export function createAngularLifecycle<Component, Props extends object = Record<string, unknown>>(
  options: AngularLifecycleOptions<Component, Props>,
): AngularLifecycle<Props> {
  let application: ApplicationRef | undefined;
  let component: ComponentRef<Component> | undefined;
  let host: HTMLElement | undefined;
  let generation = 0;
  const update = (props: AppProps<Props>) => {
    if (!component) throw new Error("Angular application is not mounted.");
    const { name: _name, container: _container, overlayContainer: _overlay, $runtime: _runtime, ...businessProps } = props;
    for (const [key, value] of Object.entries(options.inputs?.(props) ?? businessProps)) component.setInput(key, value);
    component.changeDetectorRef.detectChanges();
  };
  const cleanup = () => {
    generation++;
    const current = application;
    application = undefined;
    component = undefined;
    try { current?.destroy(); } finally { host?.remove(); host = undefined; }
  };
  return {
    async mount(props) {
      cleanup();
      const current = generation;
      const app = await createApplication({ providers: [provideZonelessChangeDetection(), ...(options.providers ?? [])] });
      if (current !== generation || props.$runtime.signal.aborted) { app.destroy(); props.$runtime.signal.throwIfAborted(); return; }
      application = app;
      try {
        host = props.container.ownerDocument.createElement("div");
        host.dataset.microFrameAdapter = "angular";
        props.container.append(host);
        component = createComponent(options.component, { environmentInjector: app.injector, hostElement: host });
        app.attachView(component.hostView);
        update(props);
      } catch (error) { cleanup(); throw error; }
    },
    update,
    unmount: cleanup,
  };
}

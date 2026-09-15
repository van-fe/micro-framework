import type {
  DocumentBridgePlugin,
  DocumentBridgePluginContext,
} from "@micro-framework/contracts";
import type { DomSurface } from "@micro-framework/dom-surface";

interface InstalledPlugin {
  readonly cleanup?: () => void;
  readonly name: string;
  readonly restoreProperties: Array<() => void>;
}

export interface DocumentBridgePluginHost {
  destroy(): void;
}

function restoreProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function cleanupFrom(
  pluginName: string,
  installation: ReturnType<DocumentBridgePlugin["install"]>,
): (() => void) | undefined {
  if (installation === undefined) return undefined;
  if (typeof installation === "function") return installation;
  if (installation && typeof installation.destroy === "function") {
    return () => installation.destroy();
  }
  throw new TypeError(`Document Bridge plugin "${pluginName}" returned an invalid installation.`);
}

function destroyPlugin(plugin: InstalledPlugin, cleanupErrors: unknown[]): void {
  try { plugin.cleanup?.(); }
  catch (error) { cleanupErrors.push(error); }
  for (const restore of plugin.restoreProperties.reverse()) {
    try { restore(); }
    catch (error) { cleanupErrors.push(error); }
  }
  plugin.restoreProperties.splice(0);
}

export function installDocumentBridgePlugins(options: {
  readonly frameWindow: Window;
  readonly hostWindow: Window;
  readonly plugins?: readonly DocumentBridgePlugin[];
  readonly surface: DomSurface;
  readonly trackVisualNode: <T extends Node>(node: T) => T;
}): DocumentBridgePluginHost {
  const plugins = options.plugins ?? [];
  const names = new Set<string>();
  for (const plugin of plugins) {
    if (!plugin.name.trim()) throw new TypeError("Document Bridge plugins require a non-empty name.");
    if (names.has(plugin.name)) {
      throw new TypeError(`Document Bridge plugin name is duplicated: ${plugin.name}`);
    }
    names.add(plugin.name);
  }

  const installed: InstalledPlugin[] = [];
  let destroyed = false;
  for (const plugin of plugins) {
    const restoreProperties: Array<() => void> = [];
    const defineDocumentProperty = (
      key: PropertyKey,
      descriptor: PropertyDescriptor,
    ): void => {
      const previous = Object.getOwnPropertyDescriptor(options.frameWindow.document, key);
      Object.defineProperty(options.frameWindow.document, key, {
        configurable: true,
        ...descriptor,
      });
      restoreProperties.push(() => restoreProperty(options.frameWindow.document, key, previous));
    };
    const context = Object.freeze({
      frameWindow: options.frameWindow,
      hostWindow: options.hostWindow,
      frameDocument: options.frameWindow.document,
      hostDocument: options.hostWindow.document,
      surface: options.surface,
      defineDocumentValue(key: PropertyKey, value: unknown) {
        defineDocumentProperty(key, { writable: true, value });
      },
      defineDocumentGetter(key: PropertyKey, get: () => unknown) {
        defineDocumentProperty(key, { get });
      },
      trackVisualNode: options.trackVisualNode,
    }) satisfies DocumentBridgePluginContext;
    try {
      installed.push({
        cleanup: cleanupFrom(plugin.name, plugin.install(context)),
        name: plugin.name,
        restoreProperties,
      });
    } catch (cause) {
      const cleanupErrors: unknown[] = [];
      destroyPlugin({ name: plugin.name, restoreProperties }, cleanupErrors);
      for (const previous of installed.reverse()) destroyPlugin(previous, cleanupErrors);
      installed.splice(0);
      throw new Error(`Document Bridge plugin "${plugin.name}" failed to install.`, { cause });
    }
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const cleanupErrors: unknown[] = [];
      for (const plugin of installed.reverse()) destroyPlugin(plugin, cleanupErrors);
      installed.splice(0);
      if (cleanupErrors.length > 0) {
        const hostConsole = Reflect.get(options.hostWindow, "console") as Console;
        hostConsole.error(
          "Document Bridge plugin cleanup failed.",
          new AggregateError(cleanupErrors),
        );
      }
    },
  };
}

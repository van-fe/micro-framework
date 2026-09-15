import type { MaybePromise } from "./lifecycle";
import type { SharedDependencyRequirements } from "./shared-dependencies";

export type AppStatus =
  | "registered" | "resolving" | "loading" | "bootstrapping" | "bootstrapped"
  | "mounting" | "mounted" | "updating" | "unmounting" | "unmounted"
  | "disposing" | "disposed" | "error";

/** Browser credentials policy for entry, resource and native module-graph requests. */
export type AppRequestCredentials = "same-origin" | "include";

export type AppEntry =
  | string
  | {
      url: string;
      type?: "auto" | "html" | "module";
      baseURL?: string;
      globalName?: string;
      integrity?: string;
      /**
       * Omit to retain each native resource's default. Explicit values also set
       * anonymous/use-credentials CORS on resources without their own crossorigin.
       * Browser CORS and cookie policies still apply; this does not replace fetch.
       */
      credentials?: AppRequestCredentials;
      manifest?: {
        url: string;
        integrity?: string;
        publicKeys?: Readonly<Record<string, string>>;
        requireSignature?: boolean;
      };
    };

export type ActiveWhen = string | ((location: Location) => boolean);

export interface StrongIsolationOptions {
  /** Render and execute the whole application inside a cross-origin sandbox iframe. */
  mode: "cross-origin";
  /** Sandbox tokens. `allow-scripts` is required; origin/top-navigation escape tokens are forbidden. */
  sandbox?: string;
  /** Optional Permissions Policy allowlist for the visible iframe. */
  allow?: string;
  title?: string;
  referrerPolicy?: ReferrerPolicy;
}

export interface AppHydrationOptions {
  /** Matches the server-rendered micro-app-host in the target container. */
  key: string;
  /** Fail on missing/invalid SSR markup or replace it with a client render. */
  onMismatch?: "error" | "client-render";
}

export interface AppRegistration<Props extends object = Record<string, unknown>> {
  name: string;
  entry: AppEntry;
  fallbackEntries?: readonly AppEntry[];
  container: string | HTMLElement | (() => HTMLElement);
  activeWhen?: ActiveWhen;
  props?: Props | (() => MaybePromise<Props>);
  preload?: boolean | "idle" | "visible";
  keepAlive?: boolean;
  sharedDependencies?: SharedDependencyRequirements;
  isolation?: StrongIsolationOptions;
  hydration?: AppHydrationOptions;
}

/** A registered application name or an unregistered entry that can be prefetched. */
export interface AppPreloadTarget {
  name?: string;
  entry: AppEntry;
}

export interface AppHandle<Props extends object = Record<string, unknown>> {
  readonly name: string;
  readonly instanceId: string;
  mount(): Promise<void>;
  update(props: Partial<Props>): Promise<void>;
  unmount(): Promise<void>;
  dispose(): Promise<void>;
  getStatus(): AppStatus;
}

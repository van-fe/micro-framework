import type { AppStatus, LifecycleEvent, RuntimeErrorEvent } from "@micro-framework/contracts";

export interface DevtoolsSubscription<T> {
  subscribe(listener: (value: T) => void): () => void;
}

export interface InspectableRuntime {
  readonly lifecycle: DevtoolsSubscription<LifecycleEvent>;
  readonly errors: DevtoolsSubscription<RuntimeErrorEvent>;
}

export interface SerializedRuntimeError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

export type RuntimeInspectorRecord =
  | {
      readonly sequence: number;
      readonly timestamp: number;
      readonly kind: "lifecycle";
      readonly event: LifecycleEvent;
    }
  | {
      readonly sequence: number;
      readonly timestamp: number;
      readonly kind: "error";
      readonly name?: string;
      readonly instanceId?: string;
      readonly phase: string;
      readonly error: SerializedRuntimeError;
    };

export interface RuntimeInspectorSnapshot {
  readonly runtimeId: string;
  readonly capturedAt: number;
  readonly applications: readonly {
    readonly name: string;
    readonly instanceId: string;
    readonly status: AppStatus;
  }[];
  readonly records: readonly RuntimeInspectorRecord[];
  readonly errorCount: number;
}

export interface RuntimeInspectorOptions {
  readonly runtimeId?: string;
  readonly maxRecords?: number;
}

export interface RuntimeInspector {
  readonly runtimeId: string;
  snapshot(): RuntimeInspectorSnapshot;
  subscribe(listener: (snapshot: RuntimeInspectorSnapshot) => void): () => void;
  clear(): void;
  destroy(): void;
}

export interface NetworkResourceTiming {
  readonly name: string;
  readonly initiatorType: string;
  readonly startTime: number;
  readonly duration: number;
  readonly responseStart: number;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
  readonly nextHopProtocol?: string;
  readonly cached: boolean;
}

export interface NetworkWaterfallSnapshot {
  readonly capturedAt: number;
  readonly timeOrigin: number;
  readonly resources: readonly NetworkResourceTiming[];
}

export interface NetworkWaterfallOptions {
  readonly maxEntries?: number;
  readonly include?: (entry: PerformanceResourceTiming) => boolean;
}

export interface NetworkWaterfall {
  snapshot(): NetworkWaterfallSnapshot;
  refresh(): void;
  subscribe(listener: (snapshot: NetworkWaterfallSnapshot) => void): () => void;
  clear(): void;
  destroy(): void;
}

export interface RuntimeDevtoolsHook {
  readonly version: 1;
  list(): readonly RuntimeInspector[];
  subscribe(listener: (inspectors: readonly RuntimeInspector[]) => void): () => void;
}

export interface ExposedRuntimeInspector {
  readonly inspector: RuntimeInspector;
  destroy(): void;
}

export interface DevtoolsPanelOptions {
  readonly title?: string;
  readonly initiallyOpen?: boolean;
  readonly networkWaterfall?: NetworkWaterfall;
}

export interface DevtoolsPanel {
  readonly host: HTMLElement;
  destroy(): void;
}

export {};

declare global {
  interface Window {
    __createMicroFrameBenchmarkRuntime__?: typeof import("@micro-framework/runtime").createRuntime;
    __microFrameRuntime__?: {
      registerApps(applications: Array<Record<string, unknown>>): void;
      prewarmApps(names?: readonly string[]): Promise<void>;
      prewarmApp(application: Record<string, unknown>): Promise<{
        dispose(): Promise<void>;
        mount(): Promise<void>;
        getStatus(): string;
      }>;
      errors: {
        subscribe(listener: (event: { phase: string }) => void): () => void;
      };
      mountApp(application: Record<string, unknown>): Promise<{
        dispose(): Promise<void>;
        mount(): Promise<void>;
        unmount(): Promise<void>;
        update(props: Record<string, unknown>): Promise<void>;
        getStatus(): string;
      }>;
      getAppStatus(name: string): string | undefined;
      getAppHandle(name: string): {
        dispose(): Promise<void>;
        mount(): Promise<void>;
        update(props: Record<string, unknown>): Promise<void>;
        unmount(): Promise<void>;
      } | undefined;
      destroy(): Promise<void>;
    };
  }
}

interface RealmBootstrapRequest {
  entry: string;
  ready(module: unknown): void;
  failed(error: unknown): void;
}

declare global {
  interface Window {
    __MICRO_FRAME_BOOTSTRAP__?: Record<string, RealmBootstrapRequest>;
  }
}

const requestId = new URL(import.meta.url).searchParams.get("micro-frame-request");
const request = requestId ? window.__MICRO_FRAME_BOOTSTRAP__?.[requestId] : undefined;
if (!request) throw new Error("Missing micro application Realm bootstrap request.");

try {
  request.ready(await import(/* @vite-ignore */ request.entry));
} catch (error) {
  request.failed(error);
}

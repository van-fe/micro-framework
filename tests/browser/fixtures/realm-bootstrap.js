const requestId = new URL(import.meta.url).searchParams.get("micro-frame-request");
const request = requestId ? window.__MICRO_FRAME_BOOTSTRAP__?.[requestId] : undefined;
if (!request) throw new Error("Missing browser-test Realm bootstrap request.");

try {
  request.ready(await import(request.entry));
} catch (error) {
  request.failed(error);
}

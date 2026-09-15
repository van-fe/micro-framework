import {
  offlineCacheProtocol,
  type OfflineWorkerRequest,
  type OfflineWorkerResponse,
} from "./protocol";
import {
  cacheApplication,
  listApplications,
  matchActive,
  removeApplication,
} from "./worker-cache-store";
import type { OfflineWorkerScope } from "./worker-scope";

export type { OfflineWorkerScope } from "./worker-scope";

interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface MessageEventLike extends MessageEvent<OfflineWorkerRequest> {
  waitUntil(promise: Promise<unknown>): void;
}

async function respond(
  scope: OfflineWorkerScope,
  request: OfflineWorkerRequest,
): Promise<unknown> {
  if (request.type === "cache-application") {
    return cacheApplication(
      scope,
      request.application,
      request.allowedOrigins,
      request.requestId,
      request.maxActiveEvictions,
      request.realmDocumentUrl,
    );
  }
  if (request.type === "remove-application") {
    return removeApplication(scope, request.applicationName);
  }
  return listApplications(scope);
}

export function installOfflineCacheWorker(scope: OfflineWorkerScope): void {
  let commandQueue = Promise.resolve();
  scope.addEventListener("install", (event) => {
    (event as ExtendableEventLike).waitUntil(scope.skipWaiting());
  });
  scope.addEventListener("activate", (event) => {
    (event as ExtendableEventLike).waitUntil(scope.clients.claim());
  });
  scope.addEventListener("message", (event) => {
    const messageEvent = event as MessageEventLike;
    const request = messageEvent.data;
    const port = messageEvent.ports[0];
    if (!port || request?.protocol !== offlineCacheProtocol) return;
    const run = async () => {
      let response: OfflineWorkerResponse;
      try {
        response = {
          protocol: offlineCacheProtocol,
          requestId: request.requestId,
          ok: true,
          value: await respond(scope, request),
        };
      } catch (error) {
        response = {
          protocol: offlineCacheProtocol,
          requestId: request.requestId,
          ok: false,
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
      port.postMessage(response);
    };
    const completed = commandQueue.then(run, run);
    commandQueue = completed.then(() => undefined, () => undefined);
    messageEvent.waitUntil(completed);
  });
  scope.addEventListener("fetch", (event) => {
    const fetchEvent = event as FetchEventLike;
    if (fetchEvent.request.method !== "GET") return;
    fetchEvent.respondWith((async () =>
      await matchActive(scope, fetchEvent.request) ?? scope.fetch(fetchEvent.request)
    )());
  });
}

export const offlineCacheProtocol = "micro-frame:offline-cache:v1" as const;

export interface OfflineApplicationInput {
  readonly name: string;
  readonly version: string;
  readonly resources: readonly string[];
}

export interface OfflineApplicationRecord {
  readonly name: string;
  readonly version: string;
  readonly resources: readonly string[];
  readonly cacheName: string;
  /** Implicit framework documents stored with this version. Legacy records may omit this field. */
  readonly runtimeResources?: readonly string[];
  readonly updatedAt: string;
  readonly evictedApplications?: readonly string[];
}

export type OfflineWorkerRequest = {
  readonly protocol: typeof offlineCacheProtocol;
  readonly requestId: string;
  readonly type: "cache-application";
  readonly application: OfflineApplicationInput;
  readonly allowedOrigins: readonly string[];
  readonly maxActiveEvictions?: number;
  readonly realmDocumentUrl?: string;
} | {
  readonly protocol: typeof offlineCacheProtocol;
  readonly requestId: string;
  readonly type: "remove-application";
  readonly applicationName: string;
} | {
  readonly protocol: typeof offlineCacheProtocol;
  readonly requestId: string;
  readonly type: "list-applications";
};

export type OfflineWorkerResponse = {
  readonly protocol: typeof offlineCacheProtocol;
  readonly requestId: string;
  readonly ok: true;
  readonly value: unknown;
} | {
  readonly protocol: typeof offlineCacheProtocol;
  readonly requestId: string;
  readonly ok: false;
  readonly error: { readonly name: string; readonly message: string };
};

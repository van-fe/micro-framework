import { installOfflineCacheWorker, type OfflineWorkerScope } from "./worker-runtime";

installOfflineCacheWorker(self as unknown as OfflineWorkerScope);

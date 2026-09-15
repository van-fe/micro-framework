export type RealmErrorKind = "error" | "unhandledrejection";

export function observeRealmErrors(
  realmWindow: Window,
  report: (error: unknown, kind: RealmErrorKind) => void,
): () => void {
  const notify = (error: unknown, kind: RealmErrorKind) => {
    try { report(error, kind); } catch { /* Error observers cannot cause a second Realm failure. */ }
  };
  const onError = (event: ErrorEvent) => notify(event.error ?? new Error(event.message), "error");
  const onRejection = (event: PromiseRejectionEvent) => notify(event.reason, "unhandledrejection");
  realmWindow.addEventListener("error", onError);
  realmWindow.addEventListener("unhandledrejection", onRejection);
  return () => {
    realmWindow.removeEventListener("error", onError);
    realmWindow.removeEventListener("unhandledrejection", onRejection);
  };
}

/** A real same-origin document is required by native history and Location APIs. */
export function resolveRealmDocumentUrl(hostDocument: Document, supplied?: string): string {
  const hostUrl = new URL(hostDocument.URL);
  const url = new URL(supplied ?? "/__micro_frame__/realm.html", hostUrl);
  if (url.origin !== hostUrl.origin || !["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("The Realm document URL must use the host document's HTTP(S) origin.");
  }
  return url.href;
}

export function loadRealmDocument(
  iframe: HTMLIFrameElement,
  parent: HTMLElement,
  url: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const fail = (error: unknown) => {
      cleanup();
      iframe.remove();
      reject(error);
    };
    const onAbort = () => fail(signal.reason);
    const onError = () => fail(new Error(`Unable to load the Realm document: ${url}`));
    const onLoad = () => {
      try {
        const document = iframe.contentDocument;
        if (!document || !iframe.contentWindow || document.URL === "about:blank") {
          throw new Error(`The Realm document did not load as a same-origin document: ${url}`);
        }
        cleanup();
        resolve();
      } catch (error) { fail(error); }
    };
    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    iframe.src = url;
    parent.append(iframe);
  });
}

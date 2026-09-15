export interface BrowserFeatures {
  shadowDom: boolean;
  modules: boolean;
  importMaps: boolean;
  modulePreload: boolean;
  structuredClone: boolean;
  abortController: boolean;
  webStorage: boolean;
  indexedDB: boolean;
  broadcastChannel: boolean;
  sharedWorker: boolean;
  webLocks: boolean;
  userActivation: boolean;
  permissions: boolean;
  clipboard: boolean;
  filePicker: boolean;
  webAuthn: boolean;
  mediaDevices: boolean;
  displayCapture: boolean;
  webShare: boolean;
  fullscreen: boolean;
  pictureInPicture: boolean;
  wakeLock: boolean;
  pointerLock: boolean;
  paymentRequest: boolean;
  notifications: boolean;
  navigation: boolean;
  urlPattern: boolean;
  viewTransitions: boolean;
  trustedTypes: boolean;
  scheduler: boolean;
  memoryMeasurement: boolean;
  scopedCustomElementRegistry: boolean;
}

export function detectBrowserFeatures(hostWindow: Window): BrowserFeatures {
  const script = hostWindow.document.createElement("script");
  const link = hostWindow.document.createElement("link");
  const scriptSupports = (script.constructor as typeof HTMLScriptElement & {
    supports?(type: string): boolean;
  }).supports;
  const rootElement = hostWindow.document.documentElement;
  const detachedElement = hostWindow.document.createElement("div");
  const detachedShadow = "attachShadow" in detachedElement
    ? detachedElement.attachShadow({ mode: "open" })
    : undefined;
  const experimentalWindow = hostWindow as Window & {
    PaymentRequest?: unknown;
    showDirectoryPicker?: unknown;
    showOpenFilePicker?: unknown;
    showSaveFilePicker?: unknown;
  };

  return {
    shadowDom: "attachShadow" in rootElement,
    modules: "noModule" in script,
    importMaps: scriptSupports?.("importmap") ?? false,
    modulePreload: link.relList.supports?.("modulepreload") ?? false,
    structuredClone: "structuredClone" in hostWindow,
    abortController: "AbortController" in hostWindow,
    webStorage: "localStorage" in hostWindow && "sessionStorage" in hostWindow,
    indexedDB: "indexedDB" in hostWindow,
    broadcastChannel: "BroadcastChannel" in hostWindow,
    sharedWorker: "SharedWorker" in hostWindow,
    webLocks: "locks" in hostWindow.navigator,
    userActivation: "userActivation" in hostWindow.navigator,
    permissions: "permissions" in hostWindow.navigator,
    clipboard: "clipboard" in hostWindow.navigator,
    filePicker: "showOpenFilePicker" in experimentalWindow
      || "showSaveFilePicker" in experimentalWindow
      || "showDirectoryPicker" in experimentalWindow,
    webAuthn: "credentials" in hostWindow.navigator && "PublicKeyCredential" in hostWindow,
    mediaDevices: "mediaDevices" in hostWindow.navigator,
    displayCapture: typeof hostWindow.navigator.mediaDevices?.getDisplayMedia === "function",
    webShare: typeof hostWindow.navigator.share === "function",
    fullscreen: "requestFullscreen" in rootElement,
    pictureInPicture: "pictureInPictureEnabled" in hostWindow.document,
    wakeLock: "wakeLock" in hostWindow.navigator,
    pointerLock: "requestPointerLock" in rootElement,
    paymentRequest: "PaymentRequest" in experimentalWindow,
    notifications: "Notification" in hostWindow,
    navigation: "navigation" in hostWindow,
    urlPattern: "URLPattern" in hostWindow,
    viewTransitions: "startViewTransition" in hostWindow.document,
    trustedTypes: "trustedTypes" in hostWindow,
    scheduler: "scheduler" in hostWindow,
    memoryMeasurement: "measureUserAgentSpecificMemory" in hostWindow.performance,
    scopedCustomElementRegistry: Boolean(detachedShadow && "customElements" in detachedShadow),
  };
}

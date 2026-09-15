import { createRuntime, type MicroRuntime } from "@micro-framework/runtime";
import {
  translate,
  workspaceMessages,
  type Locale,
  type WorkspaceView,
} from "./i18n";
import "./style.css";

declare global {
  interface Window {
    __realmCollision__?: string;
    __microFrameRuntime__?: MicroRuntime;
    __rpcHostState__?: {
      inputValue?: string;
      resultValue?: string;
    };
  }
}

const alwaysActive = () => true;

window.__realmCollision__ = "host";
window.__rpcHostState__ = {};

const status = document.querySelector<HTMLElement>("#runtime-status")!;
const hostGlobal = document.querySelector<HTMLElement>("#host-global")!;
const lastSync = document.querySelector<HTMLElement>("#last-sync")!;
const marketFilter = document.querySelector<HTMLSelectElement>("#market-filter")!;
const localeFilter = document.querySelector<HTMLSelectElement>("#locale-filter")!;
const workspaceTitle = document.querySelector<HTMLElement>("#host-title")!;
const workspaceEyebrow = document.querySelector<HTMLElement>("#workspace-eyebrow")!;
const workspaceDescription = document.querySelector<HTMLElement>("#workspace-description")!;
const mountedApps = new Set<string>();
let activeLocale: Locale = "zh-CN";
let activePeriod = "live";
let activeWorkspaceView: WorkspaceView = "overview";
hostGlobal.textContent = window.__realmCollision__;

function activateWorkspaceView(view: WorkspaceView, updateLocation = true): void {
  const content = workspaceMessages[activeLocale][view];
  activeWorkspaceView = view;
  document.body.dataset.workspaceView = view;
  workspaceTitle.textContent = content.title;
  workspaceEyebrow.textContent = content.eyebrow;
  workspaceDescription.textContent = content.description;

  for (const item of document.querySelectorAll<HTMLAnchorElement>("a[data-workspace-view]")) {
    const isActive = item.dataset.workspaceView === view;
    item.classList.toggle("nav-item--active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }

  if (updateLocation) {
    const activeItem = document.querySelector<HTMLAnchorElement>(
      `a[data-workspace-view="${view}"]`,
    );
    history.replaceState(history.state, "", activeItem?.hash || "#overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function applyHostLocale(locale: Locale): void {
  activeLocale = locale;
  document.documentElement.lang = locale;
  localeFilter.value = locale;
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    element.textContent = translate(locale, element.dataset.i18n ?? "");
  }
  lastSync.textContent = translate(locale, "sync.justNow");
  activateWorkspaceView(activeWorkspaceView, false);
}

for (const item of document.querySelectorAll<HTMLAnchorElement>("a[data-workspace-view]")) {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    activateWorkspaceView(item.dataset.workspaceView as WorkspaceView);
  });
}

const initialView = [...document.querySelectorAll<HTMLAnchorElement>("a[data-workspace-view]")]
  .find((item) => item.hash === location.hash)
  ?.dataset.workspaceView as WorkspaceView | undefined;
activateWorkspaceView(initialView ?? "overview", false);
applyHostLocale(activeLocale);

function publishEmbeddedHeight(): void {
  if (window.parent === window) return;
  window.parent.postMessage({
    type: "micro-frame-demo:resize",
    height: document.documentElement.scrollHeight,
  }, "*");
}

const embeddedResizeObserver = new ResizeObserver(publishEmbeddedHeight);
embeddedResizeObserver.observe(document.documentElement);
window.addEventListener("load", publishEmbeddedHeight, { once: true });

// Explicit opt-in for the streaming compatibility demonstration.
const documentWrite = new URLSearchParams(location.search).get("documentWrite") === "true"
  ? (await import("@micro-framework/document-write")).installDocumentWrite
  : undefined;
const runtime = createRuntime({
  documentBridge: { documentWrite },
  services: {
    probe: {
      transform(input: { value: string }) {
        input.value = "host-received";
        const result = { value: "host-result" };
        window.__rpcHostState__ = {
          inputValue: input.value,
          resultValue: result.value,
        };
        return result;
      },
    },
  },
  sharedDependencies: {
    "@micro-framework/demo-shared": [{
      version: "1.0.0",
      url: "http://127.0.0.1:5174/src/shared-marker.ts",
    }],
  },
  hooks: {
    beforeLoad: ({ name }) => {
      status.textContent = `loading ${name}`;
    },
    afterMount: ({ name }) => {
      mountedApps.add(name);
      status.textContent = `mounted ${mountedApps.size} applications`;
    },
  },
});

runtime.errors.subscribe(({ error, phase }) => {
  status.textContent = `error during ${phase}`;
  console.error(error);
});

runtime.registerApps([
  {
    name: "vanilla-orders",
    entry: {
      url: "http://127.0.0.1:5174/micro.html",
      type: "html",
    },
    container: "#vanilla-slot",
    activeWhen: alwaysActive,
    sharedDependencies: {
      imports: { "@micro-framework/demo-shared": "^1.0.0" },
    },
    props: {
      title: "Orders application",
      market: "North America",
      locale: activeLocale,
    },
  },
  {
    name: "react-dashboard",
    entry: { url: "http://127.0.0.1:5175/src/lifecycle.tsx", type: "module" },
    container: "#react-slot",
    activeWhen: alwaysActive,
    props: {
      title: "React dashboard",
      market: "North America",
      period: "live",
      locale: activeLocale,
    },
  },
  {
    name: "vue-profile",
    entry: { url: "http://127.0.0.1:5176/src/lifecycle.ts", type: "module" },
    container: "#vue-slot",
    activeWhen: alwaysActive,
    props: {
      title: "Vue profile",
      market: "North America",
      locale: activeLocale,
    },
  },
  {
    name: "vue2-console",
    entry: { url: "http://127.0.0.1:5179/src/lifecycle.ts", type: "module" },
    container: "#vue2-slot",
    activeWhen: alwaysActive,
    props: {
      title: "Vue 2 console",
      market: "North America",
      locale: activeLocale,
    },
  },
]);

async function updateMarket(market: string): Promise<void> {
  await Promise.all([
    runtime.getAppHandle("vanilla-orders")?.update({ title: "Orders application", market, locale: activeLocale }),
    runtime.getAppHandle("react-dashboard")?.update({
      title: "React dashboard",
      market,
      period: activePeriod,
      locale: activeLocale,
    }),
    runtime.getAppHandle("vue-profile")?.update({ title: "Vue profile", market, locale: activeLocale }),
    runtime.getAppHandle("vue2-console")?.update({ title: "Vue 2 console", market, locale: activeLocale }),
  ]);
  lastSync.textContent = `${market} · ${translate(activeLocale, "sync.justNow")}`;
}

marketFilter.addEventListener("change", () => {
  void updateMarket(marketFilter.value);
});

localeFilter.addEventListener("change", () => {
  applyHostLocale(localeFilter.value as Locale);
  void updateMarket(marketFilter.value);
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-period]")) {
  button.addEventListener("click", () => {
    for (const peer of document.querySelectorAll("[data-period]")) peer.classList.remove("is-active");
    button.classList.add("is-active");
    activePeriod = button.dataset.period ?? "live";
    void runtime.getAppHandle("react-dashboard")?.update({
      title: "React dashboard",
      market: marketFilter.value,
      period: activePeriod,
      locale: activeLocale,
    });
    lastSync.textContent = `analytics · ${translate(activeLocale, "sync.justNow")}`;
  });
}

document.querySelector("#refresh-workspace")?.addEventListener("click", () => {
  const refreshButton = document.querySelector<HTMLElement>("#refresh-workspace")!;
  refreshButton.classList.add("is-refreshing");
  document.querySelector("#gmv-value")!.textContent = "$1.86M";
  document.querySelector("#orders-value")!.textContent = "12,917";
  document.querySelector("#risk-value")!.textContent = "176";
  lastSync.textContent = new Intl.DateTimeFormat(activeLocale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  window.setTimeout(() => refreshButton.classList.remove("is-refreshing"), 500);
});

window.__microFrameRuntime__ = runtime;
await runtime.start();
window.requestAnimationFrame(publishEmbeddedHeight);

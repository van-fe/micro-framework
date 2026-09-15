import type {
  DevtoolsPanel,
  DevtoolsPanelOptions,
  NetworkWaterfallSnapshot,
  RuntimeInspector,
  RuntimeInspectorSnapshot,
} from "./types";

const STYLES = `
:host{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ecfdf5}
button{font:inherit;color:inherit;background:#064e3b;border:1px solid #34d399;border-radius:999px;padding:8px 12px;cursor:pointer;box-shadow:0 8px 24px #0006}
section{display:none;width:min(520px,calc(100vw - 32px));max-height:60vh;overflow:auto;margin-bottom:8px;background:#052e2bcc;border:1px solid #34d399;border-radius:12px;padding:12px;box-shadow:0 16px 48px #0009;backdrop-filter:blur(10px)}
:host([data-open]) section{display:block}h2{font:600 13px/1.4 system-ui;margin:12px 0 8px}.summary{color:#a7f3d0;margin-bottom:8px}ul{list-style:none;padding:0;margin:0;display:grid;gap:4px}li{display:flex;justify-content:space-between;gap:12px;padding:4px 6px;background:#ffffff0d;border-radius:6px}.error{color:#fca5a5}.empty{color:#94a3b8}.network-controls{display:flex;gap:6px;margin-bottom:6px}.network-controls input{min-width:0;flex:1;font:inherit;color:inherit;background:#ffffff0d;border:1px solid #34d39988;border-radius:6px;padding:5px 7px}.network-controls button{padding:5px 8px;border-radius:6px;box-shadow:none}.network li{position:relative;display:block;overflow:hidden}.network-bar{position:absolute;inset:0 auto 0 0;background:#34d3992b;pointer-events:none}.network-label{position:relative;display:flex;justify-content:space-between;gap:8px}.network-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.network-meta{flex:none;color:#a7f3d0}
`;

export function mountDevtoolsPanel(
  inspector: RuntimeInspector,
  document: Document,
  options: DevtoolsPanelOptions = {},
): DevtoolsPanel {
  const host = document.createElement("micro-frame-devtools");
  host.dataset.runtimeId = inspector.runtimeId;
  if (options.initiallyOpen) host.dataset.open = "";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  const panel = document.createElement("section");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", options.title ?? "Micro Frame DevTools");
  const title = document.createElement("h2");
  title.textContent = options.title ?? "Micro Frame DevTools";
  const summary = document.createElement("div");
  summary.className = "summary";
  const applications = document.createElement("ul");
  const records = document.createElement("ul");
  const networkTitle = document.createElement("h2");
  networkTitle.textContent = "Network waterfall";
  const networkControls = document.createElement("div");
  networkControls.className = "network-controls";
  const networkFilter = document.createElement("input");
  networkFilter.type = "search";
  networkFilter.placeholder = "Filter requests";
  networkFilter.setAttribute("aria-label", "Filter network requests");
  const clearNetwork = document.createElement("button");
  clearNetwork.type = "button";
  clearNetwork.textContent = "Clear";
  clearNetwork.dataset.action = "clear-network";
  const network = document.createElement("ul");
  network.className = "network";
  networkControls.append(networkFilter, clearNetwork);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Micro Frame";
  toggle.dataset.action = "toggle-panel";
  toggle.setAttribute("aria-expanded", String(Boolean(options.initiallyOpen)));
  toggle.addEventListener("click", () => {
    const open = !host.hasAttribute("data-open");
    host.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  panel.append(title, summary, applications, records);
  if (options.networkWaterfall) panel.append(networkTitle, networkControls, network);
  root.append(style, panel, toggle);
  document.body.append(host);

  let inspectorSnapshot: RuntimeInspectorSnapshot = inspector.snapshot();
  let networkSnapshot: NetworkWaterfallSnapshot | undefined = options.networkWaterfall?.snapshot();
  let networkQuery = "";
  const renderSummary = () => {
    summary.textContent = `${inspectorSnapshot.applications.length} apps · ${inspectorSnapshot.errorCount} errors · ${inspectorSnapshot.records.length} records${networkSnapshot ? ` · ${networkSnapshot.resources.length} requests` : ""}`;
  };
  const renderNetwork = () => {
    if (!networkSnapshot) return;
    const query = networkQuery.toLocaleLowerCase();
    const resources = networkSnapshot.resources.filter((resource) =>
      resource.name.toLocaleLowerCase().includes(query));
    const end = Math.max(1, ...resources.map((resource) => resource.startTime + resource.duration));
    network.replaceChildren(...resources.slice(-30).map((resource) => {
      const item = document.createElement("li");
      item.title = resource.name;
      const bar = document.createElement("span");
      bar.className = "network-bar";
      bar.style.marginLeft = `${Math.min(100, resource.startTime / end * 100)}%`;
      bar.style.width = `${Math.max(1, resource.duration / end * 100)}%`;
      const label = document.createElement("span");
      label.className = "network-label";
      const name = document.createElement("span");
      name.className = "network-name";
      name.textContent = `${resource.initiatorType} · ${resource.name}`;
      const meta = document.createElement("span");
      meta.className = "network-meta";
      meta.textContent = `${resource.duration.toFixed(1)} ms${resource.cached ? " · cache" : ""}`;
      label.append(name, meta);
      item.append(bar, label);
      return item;
    }));
    if (!resources.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = query ? "No matching network requests" : "No resource timings yet";
      network.replaceChildren(empty);
    }
  };
  const unsubscribe = inspector.subscribe((snapshot) => {
    inspectorSnapshot = snapshot;
    renderSummary();
    applications.replaceChildren(...snapshot.applications.map((application) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${application.name} · ${application.instanceId}`;
      const status = document.createElement("span");
      status.textContent = application.status;
      item.append(name, status);
      return item;
    }));
    if (!snapshot.applications.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No application lifecycle events yet";
      applications.replaceChildren(empty);
    }
    records.replaceChildren(...snapshot.records.slice(-8).reverse().map((record) => {
      const item = document.createElement("li");
      if (record.kind === "error") item.className = "error";
      item.textContent = record.kind === "error"
        ? `${record.name ?? "runtime"}.${record.phase}: ${record.error.message}`
        : `${record.event.name}: ${record.event.previousStatus} → ${record.event.status}`;
      return item;
    }));
  });
  const unsubscribeNetwork = options.networkWaterfall?.subscribe((snapshot) => {
    networkSnapshot = snapshot;
    renderSummary();
    renderNetwork();
  }) ?? (() => {});
  networkFilter.addEventListener("input", () => {
    networkQuery = networkFilter.value;
    renderNetwork();
  });
  clearNetwork.addEventListener("click", () => options.networkWaterfall?.clear());
  let destroyed = false;
  return {
    host,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      unsubscribeNetwork();
      host.remove();
    },
  };
}

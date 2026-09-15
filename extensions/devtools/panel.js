const status = document.getElementById("status");
const runtimes = document.getElementById("runtimes");
// A fixed, read-only expression in the inspected host. No business input is evaluated.
const expression = "JSON.stringify(window.__MICRO_FRAME_DEVTOOLS__?.version === 1 ? window.__MICRO_FRAME_DEVTOOLS__.list().map(inspector => inspector.snapshot()) : [])";
let timer;
let generation = 0;
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
function refresh() {
  if (!chrome.devtools?.inspectedWindow) return;
  const current = generation;
  chrome.devtools.inspectedWindow.eval(expression, (serialized, exception) => {
    if (current !== generation) return;
    if (exception || typeof serialized !== "string") { status.textContent = "Unable to read this page. Reload it or check its DevTools integration."; return; }
    let snapshots;
    try { snapshots = JSON.parse(serialized); if (!Array.isArray(snapshots)) throw new Error(); }
    catch { status.textContent = "Invalid Runtime snapshot."; return; }
    runtimes.replaceChildren();
    status.textContent = snapshots.length ? `${snapshots.length} Runtime(s) · read only` : "No Runtime exposed. Call exposeRuntimeToDevtools() in the host, then reload.";
    for (const snapshot of snapshots) {
      const section = document.createElement("section");
      section.append(element("h2", snapshot.runtimeId));
      const table = document.createElement("table");
      const header = document.createElement("tr");
      for (const label of ["Application", "Instance", "Status"]) header.append(element("th", label));
      table.append(header);
      for (const application of snapshot.applications ?? []) {
        const row = document.createElement("tr");
        for (const value of [application.name, application.instanceId, application.status]) row.append(element("td", value));
        table.append(row);
      }
      section.append(table, element("h3", "Recent events"));
      for (const record of (snapshot.records ?? []).slice(-30)) {
        const line = element("pre", record.kind === "error"
          ? `${record.name ?? "Runtime"} ${record.phase}: ${record.error?.message ?? "Error"}`
          : `${record.event?.instanceId}: ${record.event?.previousStatus} → ${record.event?.status}`);
        if (record.kind === "error") line.className = "error";
        section.append(line);
      }
      runtimes.append(section);
    }
  });
}
window.startInspection = () => { window.stopInspection(); refresh(); timer = setInterval(refresh, 1000); };
window.stopInspection = () => { generation++; if (timer !== undefined) clearInterval(timer); timer = undefined; };
document.getElementById("refresh").addEventListener("click", refresh);
window.addEventListener("unload", window.stopInspection);

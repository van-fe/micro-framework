chrome.devtools.panels.create("Micro Frame", "", "panel.html", (panel) => {
  let panelWindow;
  let visible = false;
  panel.onShown.addListener((view) => {
    panelWindow = view;
    visible = true;
    const start = () => { if (visible) view.startInspection(); };
    if (typeof view.startInspection === "function") start();
    else view.addEventListener("load", start, { once: true });
  });
  panel.onHidden.addListener(() => { visible = false; panelWindow?.stopInspection?.(); });
});

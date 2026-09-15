export function mount(props) {
  const applicationRoot = document.getApplicationRoot();
  const marker = document.createElement("output");
  marker.dataset.documentBridgePlugin = "mounted";
  marker.textContent = applicationRoot === props.container.getRootNode()
    ? "plugin-root-matched"
    : "plugin-root-mismatched";
  props.container.append(marker);
}

export function unmount(props) {
  props.container.replaceChildren();
}

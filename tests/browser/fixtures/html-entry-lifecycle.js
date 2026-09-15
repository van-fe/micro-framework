window.__htmlEntryOrder.push("module-lifecycle");

let root;

export function mount() {
  const data = document.getElementById("html-entry-data");
  const configuration = JSON.parse(data?.textContent ?? "{}");
  root = document.createElement("section");
  root.id = "html-entry-mounted";
  root.textContent = `${configuration.label} mounted`;
  document.body.append(root);
}

export function unmount() {
  root?.remove();
  root = undefined;
}

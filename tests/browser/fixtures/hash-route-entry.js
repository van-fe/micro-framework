let root;

export function mount() {
  root = document.createElement("p");
  root.id = "hash-route-root";
  root.textContent = "hash route mounted";
  document.body.append(root);
}

export function unmount() {
  root?.remove();
  root = undefined;
}

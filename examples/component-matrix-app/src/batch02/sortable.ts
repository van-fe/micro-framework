import Sortable from "sortablejs";

export function render(root: HTMLElement): () => void {
  const list = document.createElement("ol");
  list.className = "batch02-sortable-list";
  for (const label of ["Alpha", "Beta", "Gamma", "Delta"]) {
    const item = document.createElement("li");
    item.textContent = label;
    item.dataset.id = label;
    list.append(item);
  }
  root.append(list);
  const order = () => Array.from(list.children, (item) => (item as HTMLElement).dataset.id).join(",");
  root.dataset.order = order();
  root.dataset.ends = "0";
  const sortable = new Sortable(list, {
    animation: 0,
    onEnd(event) {
      root.dataset.order = order();
      root.dataset.ends = String(Number(root.dataset.ends) + 1);
      root.dataset.indices = `${event.oldIndex},${event.newIndex}`;
    },
  });
  return () => sortable.destroy();
}

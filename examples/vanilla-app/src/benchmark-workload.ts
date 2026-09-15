export interface BenchmarkWorkload {
  readonly root: HTMLElement;
  readonly nodeCount: number;
  dispose(): void;
}

export function mountBenchmarkWorkload(
  container: Element,
  instanceId: string,
  globals: Record<string, unknown> = window as unknown as Record<string, unknown>,
): BenchmarkWorkload {
  const globalKeys: string[] = [];
  for (let index = 0; index < 40; index += 1) {
    const key = `__microFrameBenchmark${index}`;
    globalKeys.push(key);
    globals[key] = `${instanceId}:${index}`;
  }

  const root = container.ownerDocument.createElement("article");
  root.className = "benchmark-workload";
  root.dataset.instanceId = instanceId;
  const title = container.ownerDocument.createElement("h2");
  title.textContent = "Shared benchmark workload";
  root.append(title);
  for (let index = 0; index < 40; index += 1) {
    const row = container.ownerDocument.createElement("button");
    row.type = "button";
    row.dataset.row = String(index);
    const label = container.ownerDocument.createElement("span");
    label.textContent = `Row ${index}`;
    const value = container.ownerDocument.createElement("strong");
    value.textContent = String(index * 3);
    row.append(label, value);
    row.addEventListener("click", () => {
      root.dataset.lastInteraction = String(index);
    });
    root.append(row);
  }
  container.append(root);

  return {
    root,
    nodeCount: root.querySelectorAll("*").length + 1,
    dispose() {
      root.remove();
      for (const key of globalKeys) delete globals[key];
    },
  };
}

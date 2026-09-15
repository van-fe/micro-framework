import { Dnd, Graph } from "@antv/x6";

export function render(container: HTMLElement): () => void {
  const heading = document.createElement("h2");
  heading.textContent = "X6 palette drag";
  const palette = document.createElement("button");
  palette.className = "upstream-x6-palette";
  palette.textContent = "Drag a task to the canvas";
  const canvas = document.createElement("div");
  canvas.className = "upstream-x6-canvas";
  container.append(heading, palette, canvas);
  const graph = new Graph({ container: canvas, width: 680, height: 360, grid: false });
  container.dataset.gridSize = String(graph.getGridSize());
  const dnd = new Dnd({ target: graph });
  const start = (event: MouseEvent) => {
    const node = graph.createNode({ shape: "rect", width: 100, height: 48, label: "Dropped task" });
    dnd.start(node, event);
  };
  palette.addEventListener("mousedown", start);
  graph.on("node:added", ({ node }) => {
    container.dataset.nodes = String(graph.getNodes().length);
    container.dataset.nodeX = String(node.position().x);
    container.dataset.nodeY = String(node.position().y);
  });
  return () => { palette.removeEventListener("mousedown", start); dnd.dispose(); graph.dispose(); };
}

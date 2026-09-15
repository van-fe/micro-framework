import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

(globalThis as typeof globalThis & { MonacoEnvironment: { getWorker(): Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

export function render(root: HTMLElement): () => void {
  const element = document.createElement("div");
  element.className = "batch02-monaco-editor";
  root.append(element);
  const editor = monaco.editor.create(element, {
    value: Array.from({ length: 45 }, (_, i) => `const row${String(i + 1).padStart(2, "0")} = ${i + 1};`).join("\n"),
    language: "plaintext", minimap: { enabled: false }, fontSize: 16, lineHeight: 24,
    automaticLayout: true, ariaLabel: "Nested scrolling editor", scrollBeyondLastLine: false,
  });
  const model = editor.getModel()!;
  root.dataset.value = model.getValue();
  const content = model.onDidChangeContent(() => { root.dataset.value = model.getValue(); });
  const cursor = editor.onDidChangeCursorPosition(({ position }) => {
    root.dataset.line = String(position.lineNumber); root.dataset.column = String(position.column);
  });
  const mouse = editor.onMouseDown(({ target }) => {
    root.dataset.mouseLine = String(target.position?.lineNumber ?? 0); root.dataset.mouseColumn = String(target.position?.column ?? 0);
  });
  const scroll = editor.onDidScrollChange(({ scrollTop }) => { root.dataset.editorScroll = String(scrollTop); });
  return () => { content.dispose(); cursor.dispose(); mouse.dispose(); scroll.dispose(); editor.dispose(); model.dispose(); };
}

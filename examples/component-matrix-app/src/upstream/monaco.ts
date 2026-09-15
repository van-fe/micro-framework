import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

(globalThis as typeof globalThis & { MonacoEnvironment: { getWorker(): Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

export function render(container: HTMLElement): () => void {
  const heading = document.createElement("h2");
  heading.textContent = "Monaco mouse caret";
  const element = document.createElement("div");
  element.className = "upstream-monaco-editor";
  container.append(heading, element);
  const editor = monaco.editor.create(element, {
    value: "const first = 1;\nconst middle = 2;\nconst last = 3;",
    language: "plaintext",
    minimap: { enabled: false },
    fontSize: 16,
    lineHeight: 24,
    automaticLayout: true,
    ariaLabel: "Middle-click editor",
    scrollBeyondLastLine: false,
  });
  const model = editor.getModel()!;
  container.dataset.editorValue = model.getValue();
  const change = model.onDidChangeContent(() => { container.dataset.editorValue = model.getValue(); });
  const cursor = editor.onDidChangeCursorPosition(({ position }) => {
    container.dataset.cursorLine = String(position.lineNumber);
    container.dataset.cursorColumn = String(position.column);
  });
  const mouse = editor.onMouseDown(({ target }) => {
    container.dataset.mouseLine = String(target.position?.lineNumber ?? 0);
    container.dataset.mouseColumn = String(target.position?.column ?? 0);
  });
  return () => { change.dispose(); cursor.dispose(); mouse.dispose(); editor.dispose(); model.dispose(); };
}

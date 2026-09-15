import { createApp, h, ref } from "vue";
import { ElButton, ElInput } from "element-plus";
import "element-plus/dist/index.css";

export function render(root: HTMLElement): () => void {
  const warnings: string[] = [];
  const records: { type: string; mouse: boolean; focus: boolean; trusted: boolean }[] = [];
  root.dataset.warnings = "[]";
  root.dataset.events = "[]";
  const record = (event: Event) => {
    records.push({ type: event.type, mouse: event instanceof MouseEvent, focus: event instanceof FocusEvent, trusted: event.isTrusted });
    root.dataset.events = JSON.stringify(records);
  };
  const app = createApp({
    setup() {
      const value = ref("");
      return () => h("div", [
        h("h2", "Native form events"),
        h(ElInput, {
          modelValue: value.value, placeholder: "Event validation input",
          "onUpdate:modelValue": (next: string) => { value.value = next; },
          onFocus: record, onBlur: record, onMouseenter: record, onMouseleave: record,
        }),
        h(ElButton, { onClick: record }, () => "Validate click"),
        h("button", { class: "outside-focus", onClick: () => { root.dataset.outsideClicked = "true"; } }, "Outside focus"),
      ]);
    },
  });
  app.config.warnHandler = (message) => { warnings.push(message); root.dataset.warnings = JSON.stringify(warnings); };
  app.mount(root);
  return () => app.unmount();
}

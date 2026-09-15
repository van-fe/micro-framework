import { createApp, h, ref } from "vue";
import { Select } from "ant-design-vue";
import "ant-design-vue/dist/reset.css";

export function render(root: HTMLElement): () => void {
  const warnings: string[] = [];
  root.dataset.warnings = "[]";
  const app = createApp({
    setup() {
      const selected = ref<string>();
      return () => h("div", [
        h("h2", "Virtual options"),
        h(Select, {
          value: selected.value,
          placeholder: "Choose one of 500 options",
          style: { width: "320px" },
          listHeight: 224,
          options: Array.from({ length: 500 }, (_, index) => ({ value: `option-${index}`, label: `Option ${index}` })),
          onChange(value: unknown) { selected.value = String(value); root.dataset.selected = String(value); },
        }),
      ]);
    },
  });
  app.config.warnHandler = (message) => { warnings.push(message); root.dataset.warnings = JSON.stringify(warnings); };
  app.mount(root);
  return () => app.unmount();
}

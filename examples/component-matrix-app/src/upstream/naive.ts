import { NSelect } from "naive-ui";
import { createApp, h, ref } from "vue";

export function render(container: HTMLElement): () => void {
  const app = createApp({
    setup() {
      const value = ref<string | null>(null);
      return () => h("section", [
        h("h2", "Naive UI default portal"),
        h(NSelect, {
          class: "upstream-naive-select",
          value: value.value,
          placeholder: "Choose a region",
          options: [{ label: "North", value: "north" }, { label: "South", value: "south" }],
          "onUpdate:value": (next: string) => { value.value = next; container.dataset.selection = next; },
        }),
      ]);
    },
  });
  app.mount(container);
  return () => app.unmount();
}

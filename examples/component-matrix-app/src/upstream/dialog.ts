import { ElButton, ElDialog } from "element-plus";
import "element-plus/dist/index.css";
import { createApp, h, ref } from "vue";

export function render(container: HTMLElement): () => void {
  const app = createApp({
    setup() {
      const visible = ref(false);
      return () => h("section", [
        h("h2", "Element Plus draggable dialog"),
        h(ElButton, { onClick: () => { visible.value = true; } }, () => "Open draggable dialog"),
        h(ElDialog, {
          modelValue: visible.value,
          "onUpdate:modelValue": (next: boolean) => { visible.value = next; },
          title: "Drag to viewport edges",
          width: 360,
          draggable: true,
          appendToBody: true,
        }, () => h("p", "The pointer should reach the visible bottom-right edge.")),
      ]);
    },
  });
  app.mount(container);
  return () => app.unmount();
}

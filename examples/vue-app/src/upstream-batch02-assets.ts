import { createApp, defineComponent, h, ref, type App } from "vue";

let application: App | undefined;
export function mount(props: { container: HTMLElement }): void {
  application = createApp(defineComponent({
    setup() {
      const count = ref(4);
      return () => h("section", { "data-batch02-vue-assets": "" }, [
        h("button", { onClick: () => count.value++ }, "Add image"),
        ...Array.from({ length: count.value }, (_, index) => h("div", { key: index }, [
          h("img", { src: `/batch02/pixel.svg?image=${index}`, alt: `Asset ${index}`, width: 8, height: 8 }),
          h("div", { "data-asset-background": index, style: { width: "8px", height: "8px", backgroundImage: `url(/batch02/pixel.svg?background=${index})` } }),
        ])),
      ]);
    },
  }));
  application.mount(props.container);
}
export function unmount(): void { application?.unmount(); application = undefined; }

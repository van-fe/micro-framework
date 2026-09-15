import { defineComponent, h, ref } from "vue";
import { createVueLifecycle } from "@micro-framework/adapter-vue";

const component = defineComponent({
  props: { title: { type: String, required: true } },
  setup(props) {
    const count = ref(5);
    return () => h("article", { "data-ssr-root": "" }, [
      h("h1", { "data-ssr-title": "" }, props.title),
      h("button", { type: "button", onClick: () => count.value++ }, `SSR count: ${count.value}`),
    ]);
  },
});
const lifecycle = createVueLifecycle<{ title: string }>({ component });
export const { hydrate, mount, update, unmount } = lifecycle;

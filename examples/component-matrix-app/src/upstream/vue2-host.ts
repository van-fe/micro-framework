import Vue from "vue2";

export function createVue2Host(container: HTMLElement): { slot: HTMLElement; destroy(): void } {
  const vm = new Vue({
    render(h) { return h("section", { class: "upstream-vue2-host" }, [h("div", { ref: "slot" })]); },
  });
  vm.$mount();
  container.append(vm.$el);
  return { slot: vm.$refs.slot as HTMLElement, destroy() { vm.$destroy(); vm.$el.remove(); } };
}

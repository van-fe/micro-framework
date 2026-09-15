import Vue, { type CreateElement } from "vue";
import VueRouter from "vue-router";

Vue.use(VueRouter);
Reflect.set(window, "__batch02RouterRealm__", true);
let application: Vue | undefined;

interface Props {
  container: HTMLElement;
  routerMode: "history" | "hash";
  route: string;
  $runtime: { services: { call(name: string, method: string, payload: unknown): Promise<unknown> } };
}

export async function mount(props: Props): Promise<void> {
  const router = new VueRouter({
    mode: props.routerMode,
    routes: [
      { path: "/home", component: Vue.extend({ render: h => h("p", "Router home") }) },
      { path: "/about", component: () => import("./router-about") },
    ],
  });
  await router.replace(props.route);
  const root = document.createElement("div");
  props.container.appendChild(root);
  const options = {
    router,
    render: (h: CreateElement) => h("section", [
      h("p", { attrs: { "data-router-mode": props.routerMode } }, `Vue Router ${props.routerMode}`),
      h("router-view"),
      h("button", { on: { click: () => props.$runtime.services.call("navigateAcrossApps", "$call", "/hash/about") } }, "Open cold hash about"),
    ]),
  };
  application = new Vue(options).$mount(root);
}

export function unmount(props: Props): void {
  application?.$destroy();
  application = undefined;
  props.container.replaceChildren();
}

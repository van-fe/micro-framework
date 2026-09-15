import Vue from "vue";
import { createVue2Lifecycle } from "@micro-framework/adapter-vue2";

const warnings: string[] = [];
let root: HTMLElement | undefined;
const component = Vue.extend({
  name: "NoImplicitStyleProp",
  props: { label: { type: String, required: true } },
  render(h) { return h("p", { attrs: { "data-business-label": this.label } }, this.label); },
});
const lifecycle = createVue2Lifecycle<{ label: string }>({
  component,
  configure(Constructor) {
    Constructor.config.warnHandler = (message) => { warnings.push(message); if (root) root.dataset.warnings = JSON.stringify(warnings); };
  },
});

type Props = Parameters<typeof lifecycle.mount>[0];
export function mount(props: Props): void {
  warnings.length = 0;
  root = document.createElement("section");
  root.className = "batch02-vue2-style-prop";
  root.dataset.warnings = "[]";
  const options = (component as unknown as { options: { props?: Record<string, unknown> } }).options;
  root.dataset.declaredProps = Object.keys(options.props ?? {}).join(",");
  props.container.append(root);
  lifecycle.mount({ ...props, container: root });
  root.dataset.ready = "true";
}
export function update(props: Props): void { lifecycle.update(props); }
export function unmount(props: Props): void { lifecycle.unmount(props); root?.remove(); root = undefined; }

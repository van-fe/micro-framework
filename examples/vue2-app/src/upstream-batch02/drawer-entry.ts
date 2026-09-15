import Vue from "vue";
import ElementUI from "element-ui";
import "element-ui/lib/theme-chalk/index.css";

let app: Vue | undefined;
let element: HTMLElement | undefined;

export function mount(props: { container: HTMLElement; local: boolean }): void {
  Vue.use(ElementUI);
  const root = document.createElement("section");
  root.className = "batch02-vue2-drawer";
  root.dataset.warnings = "[]";
  const warnings: string[] = [];
  Vue.config.warnHandler = (message) => { warnings.push(message); root.dataset.warnings = JSON.stringify(warnings); };
  const target = document.createElement("div");
  root.append(target); props.container.append(root); element = root;
  app = new Vue({
    data: () => ({ visible: false, selected: "" }),
    render(h) {
      return h("div", [
        h("el-button", { on: { click: () => { this.visible = true; } } }, "Open select drawer"),
        h("el-drawer", {
          props: { visible: this.visible, title: "Select within drawer", appendToBody: true, size: "460px" },
          on: { "update:visible": (value: boolean) => { this.visible = value; } },
        }, [h("div", { style: { padding: "48px 32px" } }, [
          h("el-select", {
            props: { value: this.selected, placeholder: "Drawer selection", popperAppendToBody: !props.local },
            on: { input: (value: string) => { this.selected = value; root.dataset.selected = value; } },
          }, ["North", "South", "East"].map((label) => h("el-option", { props: { label, value: label } }))),
        ])]),
      ]);
    },
  });
  app.$mount(target);
  root.dataset.ready = "true";
}

export function unmount(): void { app?.$destroy(); app = undefined; element?.remove(); element = undefined; }

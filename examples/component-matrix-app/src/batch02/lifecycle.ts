import type { AppProps } from "@micro-framework/contracts";
import "./style.css";

export const scenarios = ["ant-select", "events", "sortable", "monaco"] as const;
export type Scenario = typeof scenarios[number];
type Renderer = (root: HTMLElement) => Promise<() => void> | (() => void);
const loaders: Record<Scenario, () => Promise<{ render: Renderer }>> = {
  "ant-select": () => import("./ant-select"),
  events: () => import("./element-events"),
  sortable: () => import("./sortable"),
  monaco: () => import("./monaco"),
};
let dispose: (() => void) | undefined;

export async function mount(props: AppProps<{ scenario: Scenario }>): Promise<void> {
  const root = document.createElement("section");
  root.className = `batch02-component batch02-${props.scenario}`;
  root.dataset.realm = window === globalThis && document.defaultView === window ? "application" : "incorrect";
  props.container.append(root);
  const { render } = await loaders[props.scenario]();
  const cleanup = await render(root);
  root.dataset.ready = "true";
  dispose = () => { cleanup(); root.remove(); };
}

export function unmount(): void { dispose?.(); dispose = undefined; }

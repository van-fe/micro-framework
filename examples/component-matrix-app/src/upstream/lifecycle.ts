import type { AppProps } from "@micro-framework/contracts";
import "./style.css";

export const scenarios = ["x6", "bpmn", "naive", "recharts", "dialog", "monaco"] as const;
export type Scenario = typeof scenarios[number];
type Renderer = (container: HTMLElement) => Promise<() => void> | (() => void);
const renderers: Record<Scenario, () => Promise<{ render: Renderer }>> = {
  x6: () => import("./x6"),
  bpmn: () => import("./bpmn"),
  naive: () => import("./naive"),
  recharts: () => import("./recharts"),
  dialog: () => import("./dialog"),
  monaco: () => import("./monaco"),
};

let cleanup: (() => void) | undefined;

export async function renderScenario(container: HTMLElement, scenario: Scenario): Promise<() => void> {
  const root = document.createElement("section");
  root.className = `upstream-component upstream-${scenario}`;
  root.dataset.scenario = scenario;
  container.append(root);
  try {
    const renderer = await renderers[scenario]();
    const destroy = await renderer.render(root);
    root.dataset.ready = "true";
    return () => { destroy(); root.remove(); };
  } catch (error) {
    root.remove();
    throw error;
  }
}

export async function mount(props: AppProps<{ scenario: Scenario }>): Promise<void> {
  cleanup = await renderScenario(props.container, props.scenario);
}

export function unmount(): void {
  cleanup?.();
  cleanup = undefined;
}

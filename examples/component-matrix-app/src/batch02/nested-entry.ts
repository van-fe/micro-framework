import { createRuntime, type AppProps, type MicroRuntime } from "@micro-framework/runtime";
import type { Scenario } from "./lifecycle";
import "./style.css";

let runtime: MicroRuntime | undefined;
let element: HTMLElement | undefined;

export async function mount(props: AppProps<{ scenario: Scenario; childEntry: string }>): Promise<void> {
  const outer = document.createElement("section");
  outer.className = "batch02-parent-scroll";
  const lead = document.createElement("div");
  lead.className = "batch02-parent-spacer";
  lead.textContent = "Parent application scroll content";
  const slot = document.createElement("div");
  slot.className = "batch02-child-slot";
  const tail = document.createElement("div");
  tail.className = "batch02-parent-spacer";
  outer.append(lead, slot, tail);
  props.container.append(outer);
  element = outer;
  runtime = createRuntime({ storage: { persistent: false } });
  runtime.errors.subscribe(({ phase, error }) => { outer.dataset.error = `${phase}: ${String(error)}`; });
  await runtime.mountApp({
    name: "batch02-grandchild", container: slot,
    entry: { type: "module", url: props.childEntry },
    props: { scenario: props.scenario },
  });
  outer.dataset.ready = "true";
}

export async function unmount(): Promise<void> {
  await runtime?.destroy(); runtime = undefined;
  element?.remove(); element = undefined;
}

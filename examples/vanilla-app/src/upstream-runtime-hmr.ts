import type { AppProps } from "@micro-framework/runtime";
import "./upstream-runtime-hmr.css";

export function mount(props: AppProps): void {
  let count = 0;
  const button = document.createElement("button");
  button.dataset.upstreamHmrToken = "";
  const render = () => { button.textContent = `Live HMR: ${count}`; };
  button.addEventListener("click", () => { count++; render(); });
  render();
  props.container.appendChild(button);
}

export function unmount(props: AppProps): void { props.container.replaceChildren(); }

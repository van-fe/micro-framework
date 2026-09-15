import type { AppProps } from "@micro-framework/contracts";

interface SsrProps {
  title: string;
}

let root: HTMLElement | undefined;
let button: HTMLButtonElement | undefined;
let clickListener: (() => void) | undefined;

function bind(props: AppProps<SsrProps>, candidate: HTMLElement): void {
  root = candidate;
  root.dataset.hydratedInstance = props.$runtime.instanceId;
  button = root.querySelector<HTMLButtonElement>("[data-ssr-counter]") ?? undefined;
  if (!button) throw new Error("SSR counter button is missing.");
  clickListener = () => {
    const count = button!.querySelector<HTMLElement>("span")!;
    count.textContent = String(Number(count.textContent ?? "0") + 1);
  };
  button.addEventListener("click", clickListener);
}

function release(): void {
  if (button && clickListener) button.removeEventListener("click", clickListener);
  button = undefined;
  clickListener = undefined;
}

export function bootstrap(): void {
  // The iframe Realm is initialized before the server DOM is hydrated.
}

export function hydrate(props: AppProps<SsrProps>): void {
  const candidate = document.querySelector<HTMLElement>("[data-ssr-root]");
  if (!candidate) throw new Error("Server-rendered orders root is missing.");
  bind(props, candidate);
}

export function mount(props: AppProps<SsrProps>): void {
  const candidate = document.createElement("article");
  candidate.dataset.ssrRoot = "";
  candidate.innerHTML = `<h1 data-ssr-title></h1><button type="button" data-ssr-counter>SSR count: <span>0</span></button>`;
  props.container.append(candidate);
  bind(props, candidate);
  candidate.querySelector<HTMLElement>("[data-ssr-title]")!.textContent = props.title;
}

export function update(props: AppProps<SsrProps>): void {
  const title = root?.querySelector<HTMLElement>("[data-ssr-title]");
  if (title) title.textContent = props.title;
}

export function unmount(): void {
  release();
  root?.remove();
  root = undefined;
}

export function dispose(): void {
  release();
}

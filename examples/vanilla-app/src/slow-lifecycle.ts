import type { AppProps } from "@micro-framework/runtime";

declare global {
  interface Window {
    __slowMountStarted__?: boolean;
  }
}

export async function mount(props: AppProps): Promise<void> {
  window.__slowMountStarted__ = true;
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, 500);
    props.$runtime.signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      reject(props.$runtime.signal.reason);
    }, { once: true });
  });
  const root = document.createElement("div");
  root.id = "slow-route-root";
  root.textContent = "stale route mounted";
  document.body.append(root);
}

export function unmount(): void {
  document.querySelector("#slow-route-root")?.remove();
}

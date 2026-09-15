import { createVanillaLifecycle } from "@micro-framework/adapter-vanilla";

interface CrossTabPayload {
  readonly source: string;
  readonly sequence: number;
}

declare global {
  interface Window {
    __crossTabProbe__?: {
      readonly received: CrossTabPayload[];
      post(payload: CrossTabPayload): void;
    };
  }
}

const channel = new BroadcastChannel("runtime-cross-tab");
const received: CrossTabPayload[] = [];
channel.addEventListener("message", (event: MessageEvent<CrossTabPayload>) => {
  received.push(event.data);
});
window.__crossTabProbe__ = {
  received,
  post(payload) {
    channel.postMessage(payload);
  },
};

const lifecycle = createVanillaLifecycle({
  render(props) {
    const root = document.createElement("p");
    root.dataset.crossTabInstance = props.$runtime.instanceId;
    root.textContent = "Cross-tab channel ready";
    props.container.append(root);
    return () => root.remove();
  },
});

export const mount = lifecycle.mount;
export const unmount = lifecycle.unmount;

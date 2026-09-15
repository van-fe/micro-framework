import Vue from 'vue';
import type { AppProps } from '@micro-framework/contracts';

let app: Vue | undefined;
let destruction: Promise<unknown> | undefined;
let stop: (() => void) | undefined;
export function mount(props: AppProps): void {
  app = new Vue({
    data: () => ({ count: 0 }),
    render(h) { return h('button', { on: { click: () => { this.count++; } } }, `Vue2: ${this.count}`); },
    destroyed() { destruction = props.$runtime.services.call('vue2Destroyed', '$call', props.$runtime.instanceId); },
  });
  app.$mount(); props.container.appendChild(app.$el);
  stop = props.$runtime.events.on('vue2-probe', () => props.$runtime.events.emit('vue2-reply', props.$runtime.instanceId));
}
export async function unmount(props: AppProps): Promise<void> {
  stop?.(); stop = undefined; app?.$destroy(); await destruction; destruction = undefined; app = undefined; props.container.replaceChildren();
}

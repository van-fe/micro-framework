import { createApp, defineComponent, h, onMounted, type App } from 'vue';
import { createRouter, createWebHashHistory, RouterView, type Router } from 'vue-router';
import type { AppProps } from '@micro-framework/contracts';

type Props = AppProps<{ route: string; redirectOnMount?: boolean }>;
let app: App | undefined;
let router: Router;
export async function mount(props: Props) {
  router = createRouter({ history: createWebHashHistory(), routes: [
    { path: '/:pathMatch(.*)*', component: defineComponent({ render: () => h('p', { 'data-batch04-route': '' }, router.currentRoute.value.fullPath) }) },
  ] });
  await router.replace(props.route);
  const component = defineComponent({
    setup() {
      onMounted(() => { if (props.redirectOnMount) void router.push('/mounted-target?from=hook'); });
      return () => h('section', [h(RouterView), h('button', { onClick: () => router.push('/details') }, 'Child details')]);
    },
  });
  app = createApp(component); app.use(router); app.mount(props.container);
  await router.isReady();
}
// Host navigation already adds a history entry; reflecting it into the iframe
// replaces the child entry so one Back action traverses one host route.
export async function update(props: Props) { await router.replace(props.route); }
export function unmount() { app?.unmount(); app = undefined; router.options.history.destroy(); }

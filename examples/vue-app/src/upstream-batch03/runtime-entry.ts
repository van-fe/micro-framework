import { createApp, defineComponent, h, onBeforeUnmount, ref, type App } from 'vue';
import { createRouter, createWebHistory, RouterView, type Router } from 'vue-router';
import { createI18n } from 'vue-i18n';
import type { AppProps } from '@micro-framework/contracts';

type Props = AppProps<{ route?: string; routeState?: Record<string, string>; locale?: 'en' | 'zh'; label?: string; delayed?: boolean }>;
let app: App | undefined;
let router: Router;
let stopRoute: (() => void) | undefined;
let stopHistory: (() => void) | undefined;
let i18n: ReturnType<typeof createI18n>;

function routeTarget(url: string, state: Record<string, string> = {}) {
  // Vue Router's object form expects query/hash separately from path.
  const { path, query, hash } = router.resolve(url);
  return { path, query, hash, state };
}

export async function mount(props: Props): Promise<void> {
  router = createRouter({ history: createWebHistory(), routes: [
    { path: '/:pathMatch(.*)*', component: defineComponent({ render: () => h('p', { 'data-route': '' }, router.currentRoute.value.fullPath) }) },
  ] });
  i18n = createI18n({ legacy: false, locale: props.locale ?? 'en', messages: { en: { welcome: 'Welcome' }, zh: { welcome: '欢迎' } } });
  const historyValue = ref('');
  const updateHistory = () => { historyValue.value = String(history.state?.secret ?? 'none'); };
  window.addEventListener('popstate', updateHistory);
  stopHistory = () => window.removeEventListener('popstate', updateHistory);
  router.afterEach(updateHistory);
  const Component = defineComponent({
    setup() {
      const count = ref(0);
      const timer = setInterval(() => props.$runtime.events.emit('vue-tick', props.label ?? props.name), 10);
      onBeforeUnmount(() => clearInterval(timer));
      return { count, historyValue };
    },
    render() {
      return h('section', [
        h('p', { 'data-greeting': '' }, this.$t('welcome')),
        h(RouterView),
        h('p', { 'data-history-state': '' }, this.historyValue),
        h('button', { onClick: () => { this.count++; } }, `Vue count: ${this.count}`),
        h('button', { onClick: () => router.push({ path: '/details', state: { secret: 'child-secret' } }) }, 'Open details'),
        h('button', { onClick: () => router.back() }, 'Child back'),
      ]);
    },
  });
  app = createApp(Component); app.use(router); app.use(i18n); app.mount(props.container);
  await router.replace(routeTarget(props.route ?? '/home', props.routeState));
  await router.isReady(); updateHistory();
  stopRoute = props.$runtime.events.on<{ page: string; secret?: string }>('route-change', ({ page, secret }) => {
    void router.push(routeTarget(page, secret ? { secret } : {}));
  });
}
export async function update(props: Props): Promise<void> {
  if (props.route) await router.push(routeTarget(props.route, props.routeState));
}
export async function unmount(props: Props): Promise<void> {
  if (props.delayed) await props.$runtime.services.call('unmountGate', '$call');
  stopRoute?.(); stopHistory?.(); app?.unmount(); app = undefined; i18n?.dispose(); router?.options.history.destroy();
}

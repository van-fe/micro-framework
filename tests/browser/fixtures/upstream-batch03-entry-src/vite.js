import { createApp, h } from 'vue';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
window.batch03Owner = window;
window.batch03Evaluations = (window.batch03Evaluations || 0) + 1;
let app, router;
export async function mount({container}) {
  router = createRouter({history:createMemoryHistory(),routes:[{path:'/',component:()=>import('./home.js')},{path:'/about',component:()=>import('./about.js')}]});
  app = createApp({render:()=>h('section',[h('button',{onClick:()=>router.push('/about')},'About'),h('button',{onClick:()=>router.push('/')},'Home'),h(RouterView)])});
  app.use(router); await router.push('/'); await router.isReady(); app.mount(container);
  window.batch03Remote = await import(/* @vite-ignore */ new URL('../remote.js', import.meta.url).href);
}
export function unmount() { app.unmount(); }
window.Batch03Vite = {mount, unmount};

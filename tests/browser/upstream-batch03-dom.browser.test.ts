import { createDomSurface } from '@micro-framework/dom-surface';
import { RealmHost } from '@micro-framework/realm-host';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { domApplication, domCleanups } from './upstream-batch02-dom-fixture';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of [...cleanups.splice(0), ...domCleanups.splice(0)].reverse()) cleanup(); });
async function load(file: string, development = false) {
  const config = await (await fetch('/__batch03-dom-origin')).json() as {origin:string;devOrigin:string};
  const origin = development ? config.devOrigin : config.origin;
  const container = document.createElement('main'); document.body.append(container);
  const surface = createDomSurface(container, 'batch03-dom', crypto.randomUUID());
  const realm = new RealmHost(surface, {bootstrapUrl:new URL('/realm-bootstrap.js', location.href).href});
  let destroyed = false;
  const destroy = () => { if (destroyed) return; destroyed = true; realm.destroy(); surface.destroy(); container.remove(); };
  cleanups.push(destroy);
  const lifecycle = await realm.load({url:`${origin}/${development ? "" : "app/"}${file}`,type:'html'});
  const mount = Array.isArray(lifecycle.mount) ? lifecycle.mount : [lifecycle.mount];
  for (const callback of mount) await callback({} as never);
  const unmount = async () => {
    const callbacks = Array.isArray(lifecycle.unmount) ? lifecycle.unmount : [lifecycle.unmount];
    for (const callback of callbacks) await callback({} as never);
  };
  return { surface, realm, origin, destroy, unmount };
}

describe('batch03 DOM upstream contracts', () => {
  it('Q3151 prepares head styles before the adjacent inline script runs and preserves relative links on reload', async () => {
    const host = document.createElement('p'); host.className = 'batch03-early'; host.textContent = 'Host';
    document.body.append(host); const hostColor = getComputedStyle(host).color; cleanups.push(() => host.remove());
    for (let iteration = 0; iteration < 2; iteration++) {
      const app = await load('early.html');
      await vi.waitFor(() => {
        expect(getComputedStyle(app.surface.body.querySelector('.batch03-early')!).color).toBe('rgb(123, 45, 67)');
        expect(getComputedStyle(app.surface.body.querySelector('.batch03-link')!).color).toBe('rgb(76, 54, 32)');
      });
      expect(getComputedStyle(host).color).toBe(hostColor);
      expect(app.surface.head.querySelector('link')!.href).toBe(`${app.origin}/app/early.css`);
      expect(await (await fetch(`${app.origin}/requests`)).json()).toContain('/app/early.css');
      app.destroy(); expect(app.surface.host.isConnected).toBe(false);
    }
  });

  it('Q2983 Q2984 preserves body substrings in attribute selectors and following rules', async () => {
    const app = await domApplication();
    const style = app.frame.document.createElement('style');
    style.textContent = '[data-region="aside"][data-renderer="page"]{min-height:calc(100vh - 131px)} [data-region="body1"][data-renderer="page"]{min-height:calc(100vh - 165px)} .atest2{color:green}';
    app.frame.document.head.append(style);
    app.frame.document.body.innerHTML = '<div data-region="aside" data-renderer="page"></div><div data-region="body1" data-renderer="page"></div><p class="atest2">After</p>';
    expect(parseFloat(getComputedStyle(app.surface.body.querySelector('[data-region="aside"]')!).minHeight)).toBe(window.innerHeight - 131);
    expect(parseFloat(getComputedStyle(app.surface.body.querySelector('[data-region="body1"]')!).minHeight)).toBe(window.innerHeight - 165);
    expect(getComputedStyle(app.surface.body.querySelector('.atest2')!).color).toBe('rgb(0, 128, 0)');
  });

  it('Q3061 Q2968 Q2969 W1001 renders actual Vite Vue scoped imports and CSS module assets within the application', async () => {
    const host = document.createElement('p'); host.className = 'batch03-global'; host.textContent = 'Host';
    document.body.append(host); const hostColor = getComputedStyle(host).color; cleanups.push(() => host.remove());
    const app = await load('vue.html');
    const sibling = await domApplication(); sibling.surface.body.innerHTML = '<p class="batch03-global">Sibling</p>';
    const siblingNode = sibling.surface.body.firstElementChild!; const siblingColor = getComputedStyle(siblingNode).color;
    await vi.waitFor(() => {
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-global')!).color).toBe('rgb(17, 35, 53)');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-scoped')!).width).toBe('83px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-imported')!).width).toBe('91px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-at-import')!).width).toBe('99px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-at-import')!).color).toBe('rgb(29, 51, 73)');
    });
    expect(app.surface.body.querySelector('.batch03-scoped')!.getAttributeNames().some(name => name.startsWith('data-v-'))).toBe(true);
    const moduleNode = [...app.surface.body.querySelectorAll('p')].find(node => node.textContent === 'CSS module asset')!;
    const background = getComputedStyle(moduleNode).backgroundImage;
    expect(background).toContain(`${app.origin}/app/assets/`);
    const image = new Image(); image.src = background.slice(5,-2); await image.decode();
    expect(image.naturalWidth).toBe(24); expect(image.naturalHeight).toBe(16);
    const requests = await (await fetch(`${app.origin}/requests`)).json() as string[];
    expect(requests.some(path => /^\/app\/assets\/pixel-.*\.svg$/.test(path))).toBe(true);
    expect(getComputedStyle(host).color).toBe(hostColor); expect(getComputedStyle(siblingNode).color).toBe(siblingColor);
    await app.unmount(); expect(app.surface.body.querySelector('#app')!.childElementCount).toBe(0);
    app.destroy(); expect(app.surface.host.isConnected).toBe(false);
  });

  it('Q3061 Q2968 Q2969 W1001 preserves Vite dev injected global scoped and CSS module styles', async () => {
    const host = document.createElement('p'); host.className = 'batch03-global'; host.textContent = 'Host';
    document.body.append(host); const hostColor = getComputedStyle(host).color; cleanups.push(() => host.remove());
    const app = await load('vue.html', true);
    await vi.waitFor(() => {
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-global')!).color).toBe('rgb(17, 35, 53)');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-scoped')!).width).toBe('83px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-imported')!).width).toBe('91px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-at-import')!).width).toBe('99px');
      expect(getComputedStyle(app.surface.body.querySelector('.batch03-at-import')!).color).toBe('rgb(29, 51, 73)');
    });
    expect(app.surface.head.querySelectorAll('style[data-vite-dev-id]').length).toBeGreaterThanOrEqual(4);
    const moduleNode = [...app.surface.body.querySelectorAll('p')].find(node => node.textContent === 'CSS module asset')!;
    const background = getComputedStyle(moduleNode).backgroundImage;
    expect(background).toContain(`${app.origin}/pixel.svg`);
    const image = new Image(); image.src = background.slice(5,-2); await image.decode();
    expect(image.naturalWidth).toBe(24); expect(image.naturalHeight).toBe(16);
    expect(getComputedStyle(host).color).toBe(hostColor);
    await app.unmount(); expect(app.surface.body.querySelector('#app')!.childElementCount).toBe(0);
    app.destroy(); expect(app.surface.host.isConnected).toBe(false);
  });

  it('W1040 loads grandchild icon fonts without copying fonts to its parent and cleans up isolated families', async () => {
    const initialFonts = [...document.fonts];
    const outer = await domApplication();
    const child = await domApplication(outer.surface.body);
    const grandchild = await domApplication(child.surface.body, new URL('/nested/assets/index.html', location.href).href);
    const sibling = await domApplication(child.surface.body);
    const normal = grandchild.probe.fontStyles!('../../upstream-batch02-font-normal.ttf');
    const wide = sibling.probe.fontStyles!('/upstream-batch02-font-wide.ttf');
    await vi.waitFor(async () => {
      expect((await normal.loaded()).length).toBe(1);
      expect((await wide.loaded()).length).toBe(1);
      expect(normal.node.getBoundingClientRect().width).toBe(20);
      expect(wide.node.getBoundingClientRect().width).toBe(40);
    });
    expect(child.surface.styles.fonts.entries()).toHaveLength(0);
    expect(outer.surface.styles.fonts.entries()).toHaveLength(0);
    grandchild.destroy(); sibling.destroy(); child.destroy(); outer.destroy();
    await vi.waitFor(() => expect([...document.fonts]).toEqual(initialFonts));
  });

  it('native registry control upgrades an adopted undefined element without changing its identity', async () => {
    const iframe = document.createElement('iframe'); iframe.hidden = true;
    iframe.srcdoc = '<!doctype html><script src="/upstream-batch03-dom-native-control.js"></script>';
    const loaded = new Promise<void>(resolve => iframe.onload = () => resolve());
    document.body.append(iframe); cleanups.push(() => iframe.remove()); await loaded;
    const result = Reflect.get(iframe.contentWindow!, 'batch03NativeResult');
    cleanups.push(() => result.node.remove());
    expect(result.afterAdopt, JSON.stringify({before:result.beforeAdopt,after:result.afterAdopt,connected:result.connected})).toBe(true);
    expect(result.connected).toBe('native-connected');
    expect(customElements.get(result.tag)).toBeUndefined();
  });

  it('W1046 W1047 W1048 W1061 upgrades React effect loaded web components and retains nested composed event paths', async () => {
    const app = await load('react.html');
    const sibling = await load('react.html');
    const frame = app.surface.host.querySelector('iframe')!.contentWindow!;
    const siblingFrame = sibling.surface.host.querySelector('iframe')!.contentWindow!;
    let component: HTMLElement | null = null;
    await vi.waitFor(() => {
      component = app.surface.body.querySelector('batch03-button');
      expect(component?.shadowRoot?.querySelector('button')?.textContent, JSON.stringify({registered:!!frame.customElements.get('batch03-button'),loaded:!!Reflect.get(frame,'batch03ComponentRealm'),html:component?.outerHTML,scripts:[...frame.document.scripts].map(script=>script.src)})).toBe('Count: 0');
      expect(sibling.surface.body.querySelector('batch03-button')?.shadowRoot?.querySelector('button')?.textContent).toBe('Count: 0');
    });
    expect(Reflect.get(frame, 'batch03ComponentRealm')).toBe(frame);
    expect(customElements.get('batch03-button')).toBeUndefined();
    const definition = frame.customElements.get('batch03-button')!;
    const siblingDefinition = siblingFrame.customElements.get('batch03-button')!;
    expect(definition).not.toBe(siblingDefinition);
    expect(component).toBeInstanceOf(definition);
    expect(component).not.toBeInstanceOf(siblingDefinition);
    expect(Reflect.get(component!, "applicationIdentity")).not.toBe(Reflect.get(sibling.surface.body.querySelector("batch03-button")!, "applicationIdentity"));
    const button = component!.shadowRoot!.querySelector('button')!;
    for (let i = 1; i <= 3; i++) { button.click(); expect(button.textContent).toBe(`Count: ${i}`); }
    expect(Reflect.get(frame, 'batch03Paths')).toHaveLength(3);
    for (const path of Reflect.get(frame, 'batch03Paths')) expect(path.slice(0,3)).toEqual(['BUTTON','#document-fragment','BATCH03-BUTTON']);
    expect(Reflect.get(frame, 'batch03DocumentPath').slice(0,3)).toEqual(['BUTTON','#document-fragment','BATCH03-BUTTON']);
    expect(Reflect.get(siblingFrame, 'batch03Paths')).toHaveLength(0);
    await app.unmount(); expect(Reflect.get(frame, 'batch03Disconnected')).toBe(1);
    app.destroy(); expect(sibling.surface.body.querySelector('batch03-button')!.shadowRoot!.querySelector('button')!.textContent).toBe('Count: 0');
  });
});

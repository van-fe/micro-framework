import { afterEach, describe, expect, it } from 'vitest';
import { domApplication, domCleanups } from './upstream-batch02-dom-fixture';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of [...cleanups.splice(0), ...domCleanups.splice(0)].reverse()) cleanup(); });
async function application() {
  const app = await domApplication();
  const script = app.bridge.nativeCreateElement('script');
  script.src = '/upstream-batch04-dom-probe.js';
  const loaded = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Cannot load batch04 DOM probe'));
  });
  app.bridge.nativeHead.append(script); await loaded;
  const probe = Reflect.get(app.frame, 'batch04') as {
    identity: Window;
    prototype(name: string): {host: unknown;child: string};
    inspectPrototype(): string | undefined;
    events(): {window: number;document: number};
    dispatch(): void;
    readonlyCreateElement(): {same: boolean;node: HTMLElement};
    styles(): {first: HTMLStyleElement;second: HTMLStyleElement};
  };
  return { ...app, probe };
}

describe('batch04 DOM upstream contracts', () => {
  it('Q3067 isolates String prototype extensions and application window and document listeners', async () => {
    Reflect.set(String.prototype, '__batch04Host', 'host');
    cleanups.push(() => { Reflect.deleteProperty(String.prototype, '__batch04Host'); });
    const first = await application(); const second = await application();
    expect(first.probe.identity).toBe(first.frame);
    expect(first.probe.prototype('first')).toEqual({host: undefined, child: 'first'});
    expect(second.probe.inspectPrototype()).toBeUndefined();
    expect(second.probe.prototype('second')).toEqual({host: undefined, child: 'second'});
    expect(first.probe.inspectPrototype()).toBe('first');
    expect(Reflect.get(String.prototype, '__batch04Child')).toBeUndefined();
    const firstEvents = first.probe.events(); const secondEvents = second.probe.events();
    first.probe.dispatch();
    expect(firstEvents).toEqual({window: 1, document: 1});
    expect(secondEvents).toEqual({window: 0, document: 0});
    window.dispatchEvent(new Event('batch04-private')); document.dispatchEvent(new Event('batch04-private'));
    expect(firstEvents).toEqual({window: 1, document: 1});
    expect(secondEvents).toEqual({window: 0, document: 0});
    first.destroy(); second.probe.dispatch();
    expect(firstEvents).toEqual({window: 1, document: 1});
    expect(secondEvents).toEqual({window: 1, document: 1});
    expect(first.surface.host.isConnected).toBe(false);
  });

  it('Q3042 preserves a readonly nonconfigurable document createElement value and creates scoped nodes', async () => {
    const hostFactory = document.createElement;
    const app = await application(); const sibling = await application();
    const result = app.probe.readonlyCreateElement();
    expect(result.same).toBe(true);
    expect(app.surface.body.contains(result.node)).toBe(true);
    expect(sibling.surface.body.contains(result.node)).toBe(false);
    expect(document.createElement).toBe(hostFactory);
    expect(Object.getOwnPropertyDescriptor(app.frame.document, 'createElement')).toMatchObject({writable: false, configurable: false});
    app.destroy(); expect(result.node.isConnected).toBe(false);
  });

  it('Q3018 retains adjacent dynamically inserted styles across fresh application teardown and reload', async () => {
    const host = document.createElement('p'); host.className = 'batch04-second'; document.body.append(host);
    cleanups.push(() => host.remove()); const hostColor = getComputedStyle(host).color;
    const sibling = await application(); sibling.surface.body.innerHTML = '<p class="batch04-second">Sibling</p>';
    const siblingNode = sibling.surface.body.firstElementChild!; const siblingColor = getComputedStyle(siblingNode).color;
    for (let iteration = 0; iteration < 2; iteration++) {
      const app = await application(); const styles = app.probe.styles();
      expect(styles.first.nextElementSibling).toBe(styles.second);
      expect(app.surface.head.contains(styles.second)).toBe(true);
      expect(getComputedStyle(app.surface.body.querySelector('.batch04-first')!).color).toBe('rgb(11, 22, 33)');
      expect(getComputedStyle(app.surface.body.querySelector('.batch04-second')!).color).toBe('rgb(44, 55, 66)');
      expect(getComputedStyle(app.surface.body.querySelector('.batch04-second')!).width).toBe('84px');
      expect(getComputedStyle(host).color).toBe(hostColor);
      expect(getComputedStyle(siblingNode).color).toBe(siblingColor);
      app.destroy(); expect(styles.first.isConnected).toBe(false); expect(styles.second.isConnected).toBe(false);
    }
  });
});

import { afterEach, expect, it } from 'vitest';
import { domApplication, domCleanups } from './upstream-batch02-dom-fixture';

afterEach(() => { for (const destroy of domCleanups.splice(0).reverse()) destroy(); });

it('forwards visible viewport resize into each native Realm with listener removal once abort onresize and destroy semantics', async () => {
  const first = await domApplication(); const sibling = await domApplication();
  const hostAdd = window.addEventListener; const hostResize = window.onresize;
  const seen: Array<{event: Event;target: EventTarget | null;current: EventTarget | null;width: number}> = [];
  const listener = (event: Event) => seen.push({event,target:event.target,current:event.currentTarget,width:first.frame.innerWidth});
  let removed = 0; const removeListener = () => { removed++; };
  first.frame.addEventListener('resize', listener);
  first.frame.addEventListener('resize', removeListener); first.frame.removeEventListener('resize', removeListener);
  let once = 0; first.frame.addEventListener('resize', () => { once++; }, {once:true});
  const controller = new first.frame.AbortController();
  let aborted = 0; first.frame.addEventListener('resize', () => { aborted++; }, {signal:controller.signal}); controller.abort();
  let assigned = 0; first.frame.onresize = () => { assigned++; };
  let siblingCalls = 0; sibling.frame.addEventListener('resize', () => { siblingCalls++; });
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('resize'));
  expect(seen).toHaveLength(2); expect(removed).toBe(0); expect(once).toBe(1); expect(aborted).toBe(0); expect(assigned).toBe(2); expect(siblingCalls).toBe(2);
  for (const result of seen) {
    expect(result.event).toBeInstanceOf(first.frame.Event);
    expect(result.event).not.toBeInstanceOf(Event);
    expect(result.target).toBe(first.frame); expect(result.current).toBe(first.frame); expect(result.width).toBe(window.innerWidth);
  }
  first.frame.removeEventListener('resize', listener); first.frame.onresize = null;
  window.dispatchEvent(new Event('resize'));
  expect(seen).toHaveLength(2); expect(assigned).toBe(2); expect(siblingCalls).toBe(3);
  first.frame.onresize = () => { assigned++; };
  first.bridge.destroy();
  window.dispatchEvent(new Event('resize'));
  expect(assigned).toBe(2); expect(siblingCalls).toBe(4);
  expect(window.addEventListener).toBe(hostAdd); expect(window.onresize).toBe(hostResize);
});

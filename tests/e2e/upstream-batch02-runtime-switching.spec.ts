import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, expect, expectStatus, installRouteLinks, test } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

for (const keepAlive of [false, true]) {
  test(`Q2346 rapid native tab switching leaves hidden Realms unable to intercept host or application clicks (keepAlive=${keepAlive})`, async ({ page }) => {
    await addSlot(page, "rapid-tab-slot");
    await installRouteLinks(page);
    await page.route("**/batch02-rapid-tab.js", route => route.fulfill({ contentType: "text/javascript", body: `
      let count = 0;
      export async function mount(props) {
        await props.$runtime.services.call('rapidTabReady', '$call');
        const button = document.createElement('button');
        const render = () => button.textContent = props.title + ': ' + count;
        button.onclick = () => { count++; render(); };
        render(); props.container.appendChild(button);
      }
      export function unmount(props) { props.container.replaceChildren(); }
    ` }));
    await page.evaluate(async keepAlive => {
      const state = window.__upstreamRuntime__!;
      let ready = false;
      const waiting: Array<() => void> = [];
      state.calls.rapidTabPending = 0;
      state.runtime.services.set("rapidTabReady", () => {
        state.calls.rapidTabPending!++;
        return ready ? Promise.resolve() : new Promise<void>(resolve => waiting.push(resolve));
      });
      state.releases.rapidTab = () => { ready = true; for (const resolve of waiting) resolve(); };
      const hostButton = document.body.appendChild(document.createElement("button"));
      hostButton.id = "rapid-host-counter"; hostButton.textContent = "Host clicks: 0";
      hostButton.onclick = () => {
        state.calls.hostClicks = (state.calls.hostClicks ?? 0) + 1;
        hostButton.textContent = `Host clicks: ${state.calls.hostClicks}`;
      };
      state.slots.push(hostButton);
      state.runtime.registerApps(["a", "b"].map(name => ({
        name: `rapid-${name}`, container: state.slots[0]!, activeWhen: `/${name}`, keepAlive,
        entry: { type: "module" as const, url: new URL("/batch02-rapid-tab.js", location.href).href },
        props: { title: name.toUpperCase() },
      })));
      await state.runtime.start();
    }, keepAlive);
    await page.getByRole("link", { name: "Route A", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.rapidTabPending)).toBe(1);
    for (let index = 0; index < 12; index++) {
      await page.getByRole("link", { name: `Route ${index % 2 === 0 ? "B" : "A"}`, exact: true }).click();
    }
    await page.getByRole("link", { name: "Route B", exact: true }).click();
    await page.evaluate(() => window.__upstreamRuntime__!.releases.rapidTab!());
    await expectStatus(page, "rapid-b", "mounted");
    await expect(page.locator("#rapid-tab-slot micro-app-host:not([hidden])")).toHaveCount(1);
    const app = page.locator('#rapid-tab-slot micro-app-host[data-micro-app="rapid-b"]');
    await app.getByRole("button").click();
    await expect(app.getByRole("button")).toHaveText("B: 1");
    await page.locator("#rapid-host-counter").click();
    await expect(page.locator("#rapid-host-counter")).toHaveText("Host clicks: 1");
    const hitTest = await page.evaluate(() => {
      const frames = [...document.querySelectorAll<HTMLIFrameElement>("#rapid-tab-slot iframe")];
      const host = document.querySelector<HTMLElement>('#rapid-tab-slot micro-app-host[data-micro-app="rapid-b"]')!;
      const button = host.shadowRoot!.querySelector("button")!;
      const bounds = button.getBoundingClientRect();
      return {
        frames: frames.map(frame => ({ hidden: frame.hidden,
          width: frame.getBoundingClientRect().width, height: frame.getBoundingClientRect().height })),
        hostHit: document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === host,
        appHit: host.shadowRoot!.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === button,
      };
    });
    expect(hitTest.frames.length).toBeGreaterThan(0);
    // Undistributed light-DOM children have no computed style in some engines.
    // Their hidden state, zero geometry, and actual hit targets establish that
    // they cannot paint over the host or intercept the native clicks above.
    for (const frame of hitTest.frames) expect(frame).toEqual({ hidden: true, width: 0, height: 0 });
    expect({ hostHit: hitTest.hostHit, appHit: hitTest.appHit }).toEqual({ hostHit: true, appHit: true });
  });
}

import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, expect, test } from "./upstream-batch02-runtime-fixture";

isolateBrowserProcess(import.meta.url);

test("Q1502 native window.location assignment navigates only the child and disposes after crossing origin", async ({ page, deployment }) => {
  await addSlot(page, "location-slot");
  await page.route("**/batch02-native-location.js", route => route.fulfill({ contentType: "text/javascript", body: `
    export function mount(props) {
      const button = document.createElement('button'); button.textContent = 'Navigate child document';
      button.onclick = () => { window.location = props.target; };
      props.container.appendChild(button);
    }
    export function unmount(props) { props.container.replaceChildren(); }
  ` }));
  const target = new URL("/navigation-target.html", deployment.url).href;
  await page.evaluate(async target => {
    const state = window.__upstreamRuntime__!;
    state.handles.push(await state.runtime.mountApp({
      name: "native-location", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/batch02-native-location.js", location.href).href },
      props: { target },
    }));
  }, target);
  const hostURL = page.url();
  const navigation = page.waitForEvent("framenavigated", frame => frame !== page.mainFrame() && frame.url() === target);
  await page.getByRole("button", { name: "Navigate child document", exact: true }).click();
  const child = await navigation;
  await expect.poll(() => child.title()).toBe("Child navigation target");
  expect(page.url()).toBe(hostURL);
  expect(deployment.requests).toContain("/navigation-target.html");
  const cleanup = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = state.handles[0]!;
    await handle.dispose();
    return { status: handle.getStatus(), remaining: state.slots[0]!.childElementCount, errors: state.errors };
  });
  expect(cleanup).toEqual({ status: "disposed", remaining: 0, errors: [] });
});

test("Q1502 native navigation during a pending module import leaves an unmounted handle that can be explicitly disposed", async ({ page, deployment }) => {
  await addSlot(page, "location-loading-slot");
  const target = new URL("/navigation-target.html", deployment.url).href;
  await page.route("**/batch02-loading-location.js", route => route.fulfill({ contentType: "text/javascript", body: `
    window.location = ${JSON.stringify(target)};
    await new Promise(() => {});
    export function mount() { throw new Error('The departing module must never mount'); }
  ` }));
  const hostURL = page.url();
  const result = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = await state.runtime.mountApp({
      name: "loading-location", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/batch02-loading-location.js", location.href).href },
    });
    state.handles.push(handle);
    return { status: handle.getStatus(), remaining: state.slots[0]!.childElementCount, errors: state.errors };
  });
  // Native pagehide cancels the load; it does not request disposal of the
  // manually mounted application handle. The existing abort transition is
  // unmounted, with the failed Realm and surface already released.
  expect(result).toEqual({ status: "unmounted", remaining: 0, errors: [] });
  expect(page.url()).toBe(hostURL);
  expect(deployment.requests).toContain("/navigation-target.html");
  const disposal = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = state.handles.at(-1)!;
    await handle.dispose();
    let retainedDisposalCalls = 0;
    const original = handle.dispose.bind(handle);
    handle.dispose = async () => { retainedDisposalCalls++; await original(); };
    await state.runtime.destroy();
    return { status: handle.getStatus(), remaining: state.slots[0]!.childElementCount,
      errors: state.errors, retainedDisposalCalls };
  });
  expect(disposal).toEqual({ status: "disposed", remaining: 0, errors: [], retainedDisposalCalls: 0 });
});

import { isolateBrowserProcess } from "./browser-process-fixture";
import { test, expect, addSlot } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

test("Q1174 jsPlumb 2.11.2 creates reconnects and drags real connectors in independent native Realms", async ({ page }) => {
  for (const id of ["jsplumb-a", "jsplumb-b"]) await addSlot(page, id);
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const { origin } = await (await fetch("/__batch02-entry")).json() as { origin: string };
    for (const [index, container] of state.slots.entries()) {
      state.handles.push(await state.runtime.mountApp({ name: `jsplumb-${index}`, container, entry: { type: "html", url: origin + "/jsplumb.html" } }));
    }
  });
  for (const id of ["jsplumb-a", "jsplumb-b"]) {
    const slot = page.locator(`#${id}`);
    const graph = slot.locator("[data-batch02-graph]");
    await expect(graph).toHaveAttribute("data-connections", "1");
    await expect(graph).toHaveAttribute("data-function-identity", "true");
    await expect(graph.locator("svg.jtk-connector")).toHaveCount(1);
    const source = slot.getByText("Source node", { exact: true });
    const before = await source.boundingBox();
    expect(before).not.toBeNull();
    await page.mouse.move(before!.x + 25, before!.y + 20);
    await page.mouse.down();
    await page.mouse.move(before!.x + 105, before!.y + 65, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await source.boundingBox())!.x).toBeCloseTo(before!.x + 80, 0);
    await slot.getByRole("button", { name: "Reconnect graph" }).click();
    await expect(graph).toHaveAttribute("data-connections", "1");
    await expect(graph.locator("svg.jtk-connector")).toHaveCount(1);
  }
  expect(await page.evaluate(() => ({
    hostGlobal: Reflect.has(window, "jsPlumb"),
    hostGraphs: document.querySelectorAll(".jtk-connector").length,
  }))).toEqual({ hostGlobal: false, hostGraphs: 0 });
  await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.dispose());
  await expect(page.locator("#jsplumb-a micro-app-host")).toHaveCount(0);
  await expect(page.locator("#jsplumb-b svg.jtk-connector")).toHaveCount(1);
});

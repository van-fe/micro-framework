import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

declare global {
  interface Window {
    __strongIsolationHandle__?: {
      update(props: Record<string, unknown>): Promise<void>;
      mount(): Promise<void>;
      unmount(): Promise<void>;
      dispose(): Promise<void>;
    };
  }
}

test("runs a structured lifecycle inside a visible cross-origin sandbox iframe", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__microFrameRuntime__ !== undefined);
  const instanceId = await page.evaluate(async () => {
    const slot = document.createElement("section");
    slot.id = "strong-isolation-slot";
    slot.style.height = "360px";
    document.body.append(slot);
    window.__strongIsolationHandle__ = await window.__microFrameRuntime__!.mountApp({
      name: "strong-isolation-orders",
      entry: { url: "http://127.0.0.1:5174/strong-isolation.html", type: "html" },
      container: slot,
      keepAlive: true,
      isolation: { mode: "cross-origin", sandbox: "allow-scripts" },
      props: {
        title: "Isolated orders",
        count: 3,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        labels: new Map([["region", "north"]]),
      },
    });
    return (window.__strongIsolationHandle__ as Window["__strongIsolationHandle__"] & {
      instanceId: string;
    }).instanceId;
  });

  const frameElement = page.locator("#strong-isolation-slot > iframe[data-micro-frame-strong-isolation]");
  await expect(frameElement).toBeVisible();
  await expect(frameElement).toHaveAttribute("sandbox", "allow-scripts");
  await expect(page.locator("#strong-isolation-slot micro-app-host")).toHaveCount(0);
  const guest = page.frameLocator("#strong-isolation-slot > iframe");
  await expect(guest.locator("[data-guest-title]")).toHaveText("Isolated orders");
  await expect(guest.locator("[data-guest-count]")).toHaveText("3");
  await expect(guest.locator("[data-guest-date]")).toHaveText("2026-09-01T00:00:00.000Z");
  await expect(guest.locator("[data-guest-label]")).toHaveText("north");
  await expect(guest.locator("[data-parent-access]")).toHaveText("blocked");
  await expect(guest.locator("[data-instance-id]")).toHaveText(instanceId);

  await guest.getByRole("button").click();
  await expect(guest.getByRole("button")).toContainText("Guest clicks: 1");
  await page.evaluate(async () => {
    await window.__strongIsolationHandle__!.update({
      title: "Updated isolated orders",
      count: 4,
      labels: new Map([["region", "west"]]),
    });
  });
  await expect(guest.locator("[data-guest-title]")).toHaveText("Updated isolated orders");
  await expect(guest.locator("[data-guest-label]")).toHaveText("west");
  await guest.getByRole("button").click();
  await expect(guest.getByRole("button")).toContainText("Guest clicks: 2");

  expect(await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#strong-isolation-slot > iframe")!;
    try { return frame.contentDocument?.body ? "accessible" : "blocked"; }
    catch { return "blocked"; }
  })).toBe("blocked");

  await page.evaluate(() => window.__strongIsolationHandle__!.unmount());
  await expect(frameElement).toBeHidden();
  await page.evaluate(() => window.__strongIsolationHandle__!.mount());
  await expect(frameElement).toBeVisible();
  await expect(guest.getByRole("button")).toContainText("Guest clicks: 2");

  await page.evaluate(() => window.__strongIsolationHandle__!.dispose());
  await expect(page.locator("#strong-isolation-slot > iframe")).toHaveCount(0);
});

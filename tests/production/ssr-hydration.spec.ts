import { expect, test } from "../e2e/browser-process-fixture";

declare global {
  interface Window {
    __ssrRuntime__?: { destroy(): Promise<void> };
    __ssrHandle__?: { update(props: { title: string }): Promise<void> };
    __ssrHydrationState__?: {
      sameHost: boolean;
      sameRoot: boolean;
      instanceId: string;
    };
  }
}

test("streams Declarative Shadow DOM before hydrating it in an iframe Realm", async ({ page }) => {
  const response = await page.goto("http://127.0.0.1:4276/", { waitUntil: "commit" });
  expect(response?.headers()["x-micro-frame-stream"]).toBe("v1");

  const serverRoot = page.locator("[data-ssr-root]");
  await expect(serverRoot).toBeVisible();
  await expect(serverRoot.locator("[data-ssr-title]")).toHaveText("Server orders");
  await expect(page.locator("html")).not.toHaveAttribute("data-ssr-client-ready", "");

  await expect(page.locator("html")).toHaveAttribute("data-ssr-client-ready", "");
  expect(await page.evaluate(() => window.__ssrHydrationState__)).toMatchObject({
    sameHost: true,
    sameRoot: true,
  });
  const instanceId = (await page.evaluate(() => window.__ssrHydrationState__!.instanceId));
  await expect(serverRoot).toHaveAttribute("data-hydrated-instance", instanceId);
  await serverRoot.getByRole("button").click();
  await expect(serverRoot.getByRole("button")).toContainText("SSR count: 6");

  await page.evaluate(() => window.__ssrHandle__!.update({ title: "Hydrated orders" }));
  await expect(serverRoot.locator("[data-ssr-title]")).toHaveText("Hydrated orders");
  await expect(page.locator("#ssr-slot > micro-app-host > iframe")).toHaveCount(1);

  await page.evaluate(() => window.__ssrRuntime__!.destroy());
  await expect(page.locator("#ssr-slot > micro-app-host")).toHaveCount(0);
});

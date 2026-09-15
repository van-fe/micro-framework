import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

test("uses the familiar registration API without changing the isolation model", async ({ page }) => {
  await page.goto("http://127.0.0.1:5177/");
  await expect(page.locator("#compat-status")).toHaveText("mounted compat-orders");
  await expect(page.locator("#compat-state")).toHaveText("tenant north, revision 1");

  const result = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="compat-orders"]',
    )!;
    const frame = host.querySelector("iframe")!.contentWindow as Window & {
      __realmCollision__?: string;
    };
    return {
      text: host.shadowRoot!.querySelector("#vanilla-root")?.textContent,
      frameGlobal: frame.__realmCollision__,
      hostGlobal: Reflect.get(window, "__realmCollision__"),
      iframeCount: host.querySelectorAll("iframe").length,
    };
  });

  expect(result.text).toContain("Compatibility API orders");
  expect(result.frameGlobal).toBe("micro-app");
  expect(result.hostGlobal).toBeUndefined();
  expect(result.iframeCount).toBe(1);

  await page.evaluate(async () => window.__compatRuntime__!.destroy());
  await expect(page.locator("micro-app-host")).toHaveCount(0);
});

declare global {
  interface Window {
    __compatRuntime__?: { destroy(): Promise<void> };
  }
}

import { expect, test } from "../e2e/browser-process-fixture";

for (const variant of ["standalone", "zh", "en"] as const) {
  const embedded = variant !== "standalone";
  test(`production demo mounts and cleans up all four frameworks (${variant})`, async ({ page, context }, testInfo) => {
    const errors: string[] = [];
    const failedResources: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
    });
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(variant === "en" ? "en/demo/" : embedded ? "demo/" : "playground/");
    const surface = embedded ? page.frameLocator(".demo-frame-shell iframe") : page;
    await expect(surface.locator("#runtime-status")).toHaveText("mounted 4 applications");
    await expect(surface.locator("#locale-filter")).toHaveValue(variant === "en" ? "en-US" : "zh-CN");
    if (variant === "en") {
      await expect(surface.locator("#host-title")).toContainText("Fulfillment");
      await surface.locator("#locale-filter").selectOption("zh-CN");
    }
    if (embedded) await page.locator(".demo-frame-shell").scrollIntoViewIfNeeded();
    const host = embedded ? page.frames().find((frame) => frame.url().includes("/playground/"))! : page.mainFrame();
    for (const selector of ["#vanilla-root", "#react-root .ant-btn", "#vue-root .el-button", "#vue2-root .el-button"]) {
      await expect(surface.locator(selector).first()).toBeVisible();
    }
    const isolation = await host.evaluate(() => ({
      host: (window as Window & { __realmCollision__?: string }).__realmCollision__,
      apps: [...document.querySelectorAll("micro-app-host")].map((element) => ({
        shadow: Boolean(element.shadowRoot?.querySelector("micro-app-body")),
        frame: element.querySelector("iframe")?.contentDocument?.URL,
      })),
    }));
    expect(isolation.host).toBe("host");
    expect(isolation.apps).toHaveLength(4);
    expect(isolation.apps.every((app) => app.shadow && app.frame?.includes("/playground/__micro_frame__/realm.html"))).toBe(true);
    await surface.locator("#market-filter").selectOption("Europe");
    await expect(surface.locator("#last-sync")).toContainText("Europe");
    await surface.locator("#locale-filter").selectOption("en-US");
    await expect(surface.locator("#host-title")).toContainText("Fulfillment");
    for (const [trigger, overlay, close] of [
      ["[data-open-overlay='react']", "[role='dialog']", ".ant-modal-close"],
      ["[data-open-overlay='vue3-dialog']", ".el-dialog", ".el-dialog__headerbtn"],
      ["[data-open-overlay='vue2']", ".el-dialog__wrapper .el-dialog", ".el-dialog__wrapper .el-dialog__headerbtn"],
    ] as const) {
      const app = trigger.includes("vue2") ? "vue2-console" : trigger.includes("vue3") ? "vue-profile" : "react-dashboard";
      const appHost = surface.locator(`micro-app-host[data-micro-app="${app}"]`);
      await appHost.locator(trigger).click();
      await expect(appHost.locator(overlay).first()).toBeVisible();
      await appHost.locator(close).first().click();
      await expect(appHost.locator(overlay).first()).toBeHidden();
    }
    await surface.locator("[data-order-id]").first().click();
    await surface.locator("[data-resolve]").click();
    await expect(surface.locator("dialog[data-overlay-kind='vanilla']")).toBeVisible();
    await surface.locator("[data-dialog-close]").click();
    expect(requests.some((url) => /127\.0\.0\.1:517\d|\/src\/|@vite\/client/.test(url))).toBe(false);
    expect(requests.some((url) => url.includes("document-write"))).toBe(false);
    expect(failedResources).toEqual([]);
    expect(errors).toEqual([]);
    if (embedded && testInfo.project.name === "chromium") {
      await page.screenshot({ path: testInfo.outputPath("embedded-demo.png"), fullPage: true });
    }
    await host.evaluate(async () => {
      await (window as Window & { __microFrameRuntime__?: { destroy(): Promise<void> } }).__microFrameRuntime__?.destroy();
    });
    await expect(surface.locator("micro-app-host")).toHaveCount(0);
    expect(context.serviceWorkers()).toHaveLength(0);
  });
}

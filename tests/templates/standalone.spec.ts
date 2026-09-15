import { expect, test } from "../e2e/browser-process-fixture";

for (const [index, framework] of ["vanilla", "react", "vue", "vue2"].entries()) {
  for (const mode of ["dev", "production"] as const) {
    test(`${framework} ${mode} renders its generated business entry inside an independent Realm`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${(mode === "dev" ? 6370 : 6380) + index}/`);
      const surface = page.locator("micro-app-host");
      await expect(surface.locator("main")).toHaveText(`orders-${framework}`);
      await expect(surface.locator("iframe")).toHaveCount(1);
      expect(await page.evaluate(() => {
        const host = document.querySelector("micro-app-host")!;
        const frame = host.querySelector("iframe")!;
        return {
          shadow: Boolean(host.shadowRoot?.querySelector("main")),
          hostQuery: document.querySelector("main main") === null,
          independent: frame.contentWindow !== window,
          bridge: frame.contentDocument!.querySelector("main") === host.shadowRoot!.querySelector("main"),
        };
      })).toEqual({ shadow: true, hostQuery: true, independent: true, bridge: true });
      expect(errors).toEqual([]);
    });
  }
}

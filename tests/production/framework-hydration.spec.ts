import { expect, test } from "../e2e/browser-process-fixture";

for (const framework of ["react", "vue"]) {
  test(`${framework} hydrates server nodes, preserves state on update and releases its Realm`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4276/?framework=${framework}`, { waitUntil: "commit" });
    const article = page.locator("[data-ssr-root]");
    await expect(article.locator("h1")).toHaveText("Server orders");
    await expect(page.locator("html")).toHaveAttribute("data-ssr-client-ready", "");
    expect(await page.evaluate(() => window.__ssrHydrationState__)).toMatchObject({ sameHost: true, sameRoot: true });
    await expect(article.locator("h1")).toHaveText("Hydrated orders");
    await article.getByRole("button").click();
    await expect(article.getByRole("button")).toHaveText("SSR count: 6");
    await page.evaluate(() => window.__ssrHandle__!.update({ title: "Updated again" }));
    await expect(article.locator("h1")).toHaveText("Updated again");
    await expect(article.getByRole("button")).toHaveText("SSR count: 6");
    const realm = page.frames().find((frame) => frame !== page.mainFrame())!;
    expect(await realm.evaluate(() => {
      const root = document.querySelector("[data-ssr-root]")?.getRootNode() as ShadowRoot | undefined;
      return root?.host?.getAttribute("data-micro-app");
    })).toBe("ssr-orders");
    await page.evaluate(() => window.__ssrRuntime__!.destroy());
    await expect(page.locator("micro-app-host")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

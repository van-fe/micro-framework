import type { Page } from "@playwright/test";
import { expect, test } from "../e2e/browser-process-fixture";

// VitePress awaits the page module before hydration; SSR headings can appear earlier.
async function waitForDocumentation(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(
    (document.querySelector("#app") as HTMLElement & { __vue_app__?: unknown })?.__vue_app__,
  ));
}

test("switches corresponding articles and searches within each language", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("guide/getting-started");
  await waitForDocumentation(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "切换语言", exact: true }).click();
  await page.locator(".VPNavBarTranslations").getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/guide\/getting-started$/);
  await expect(page.locator("h1")).toHaveText("Getting started");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.reload();
  await waitForDocumentation(page);
  await expect(page.locator("h1")).toHaveText("Getting started");
  const links = await page.locator(".VPNavBarMenu a, .VPSidebar a, .vp-doc a").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLAnchorElement).getAttribute("href")!).filter((href) => href.startsWith("/")),
  );
  expect(links.length).toBeGreaterThan(20);
  expect(links.every((href) => href.includes("/en/"))).toBe(true);
  await page.locator(".VPNavBarSearch button").click();
  await page.locator("#localsearch-input").fill("Document Bridge");
  await expect(page.locator("#localsearch-list a").first()).toBeVisible();
  const results = await page.locator("#localsearch-list a").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLAnchorElement).getAttribute("href")),
  );
  expect(results.every((href) => href?.includes("/en/"))).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change language", exact: true }).click();
  await page.locator(".VPNavBarTranslations").getByRole("link", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/(?<!\/en)\/guide\/getting-started$/);
  await expect(page.locator("h1")).toHaveText("快速开始");
  await page.locator(".VPNavBarSearch button").click();
  await page.locator("#localsearch-input").fill("Document Bridge");
  await expect(page.locator("#localsearch-list a").first()).toBeVisible();
  expect(await page.locator("#localsearch-list a").evaluateAll((elements) =>
    elements.every((element) => !(element as HTMLAnchorElement).href.includes("/en/")),
  )).toBe(true);
  expect(failures).toEqual([]);
});

test("offers corresponding language navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("en/reference/document-bridge");
  await waitForDocumentation(page);
  await expect(page.locator("h1")).toHaveText("Document Bridge and extension plugins");
  await page.getByRole("button", { name: "mobile navigation" }).click();
  await page.locator(".VPNavScreenTranslations button").click();
  await page.locator(".VPNavScreenTranslations").getByRole("link", { name: "简体中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("h1")).toHaveText("Document Bridge 与扩展插件");
  await page.getByRole("button", { name: "mobile navigation" }).click();
  await page.locator(".VPNavScreenTranslations button").click();
  await page.locator(".VPNavScreenTranslations").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/reference\/document-bridge$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});

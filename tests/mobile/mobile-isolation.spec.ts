import { expect, test } from "../e2e/browser-process-fixture";

test("bridges the mobile viewport and keeps touch-opened overlays application-owned", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const environment = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll<HTMLElement>("micro-app-host")];
    return {
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      maxTouchPoints: navigator.maxTouchPoints,
      mobileUserAgent: /Android|iPhone|Mobile/i.test(navigator.userAgent),
      realms: hosts.map((host) => {
        const frameWindow = host.querySelector("iframe")!.contentWindow!;
        return {
          heightMatches: frameWindow.innerHeight === innerHeight,
          scaleMatches: frameWindow.devicePixelRatio === devicePixelRatio,
          widthMatches: frameWindow.innerWidth === innerWidth,
        };
      }),
      shadowRoots: hosts.filter((host) => Boolean(host.shadowRoot)).length,
    };
  });

  expect(environment).toMatchObject({
    coarsePointer: true,
    mobileUserAgent: true,
    shadowRoots: 4,
  });
  expect(environment.coarsePointer || environment.maxTouchPoints > 0).toBe(true);
  expect(environment.realms).toHaveLength(4);
  expect(environment.realms.every(({ heightMatches, scaleMatches, widthMatches }) =>
    heightMatches && scaleMatches && widthMatches,
  )).toBe(true);

  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!;
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-open-overlay="react"]',
    )!;
    button.addEventListener("touchstart", () => {
      host.dataset.mobileTouchStarted = "true";
    }, { once: true });
    button.addEventListener("pointerdown", (event) => {
      host.dataset.mobilePointerType = event.pointerType;
    }, { once: true });
  });

  await page.locator('[data-open-overlay="react"]').tap();
  await expect(page.locator(".ant-modal-wrap")).toBeVisible();

  const overlay = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!;
    const wrap = host.shadowRoot!.querySelector<HTMLElement>(".ant-modal-wrap")!;
    const rect = wrap.getBoundingClientRect();
    return {
      coversViewport: rect.left <= 1
        && rect.top <= 1
        && rect.right >= innerWidth - 1
        && rect.bottom >= innerHeight - 1,
      hostLeaks: document.body.querySelectorAll(":scope > .ant-modal-root").length,
      pointerType: host.dataset.mobilePointerType,
      touchStarted: host.dataset.mobileTouchStarted,
      wrapBelongsToApplication: wrap.getRootNode() === host.shadowRoot,
    };
  });

  expect(overlay).toEqual({
    coversViewport: true,
    hostLeaks: 0,
    pointerType: "touch",
    touchStarted: "true",
    wrapBelongsToApplication: true,
  });

  await page.locator(".ant-modal-close").tap();
  await expect(page.locator(".ant-modal-wrap")).toBeHidden();
  await page.locator("#refresh-workspace").tap();
  await expect(page.locator("#gmv-value")).toHaveText("$1.86M");
});

test("updates Realm dimensions after a mobile viewport change and leaves no disposed surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("micro-app-host")].every((host) => {
      const frameWindow = host.querySelector("iframe")!.contentWindow!;
      return frameWindow.innerWidth === innerWidth
        && frameWindow.innerHeight === innerHeight
        && frameWindow.devicePixelRatio === devicePixelRatio;
    }),
  )).toBe(true);

  const cleanup = await page.evaluate(async () => {
    const slot = document.createElement("div");
    document.body.append(slot);
    const instanceIds: string[] = [];

    for (let index = 0; index < 4; index += 1) {
      const handle = await window.__microFrameRuntime__!.mountApp({
        name: "mobile-cleanup",
        entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
        container: slot,
        props: { title: `Mobile cleanup ${index}` },
      });
      const frameWindow = slot.querySelector("iframe")!.contentWindow as Window & {
        __vanillaInstanceId__?: string;
      };
      instanceIds.push(frameWindow.__vanillaInstanceId__ ?? "missing");
      await handle.dispose();
    }

    const remaining = {
      hosts: slot.querySelectorAll("micro-app-host").length,
      iframes: slot.querySelectorAll("iframe").length,
    };
    slot.remove();
    return { instanceIds, remaining };
  });

  expect(new Set(cleanup.instanceIds).size).toBe(4);
  expect(cleanup.remaining).toEqual({ hosts: 0, iframes: 0 });

  await page.evaluate(async () => window.__microFrameRuntime__!.destroy());
  await expect(page.locator("micro-app-host")).toHaveCount(0);
});

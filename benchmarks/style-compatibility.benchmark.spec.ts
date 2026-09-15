import { expect, test } from "./sentry-network-guard";

test("preserves HTML Entry style semantics after subtree scan reduction", async ({ page }, testInfo) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  const result = await page.evaluate(async () => {
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const handle = await runtime.mountApp({
      name: "style-compatibility",
      entry: {
        type: "html",
        url: "http://127.0.0.1:4375/style-contract.html",
        globalName: "MicroFrameStyleContract",
      },
      container: slot,
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const frameWindow = slot.querySelector("iframe")?.contentWindow as (Window & {
      __MICRO_FRAME_STYLE_CONTRACT__?: Record<string, string>;
    }) | null;
    const values = frameWindow?.__MICRO_FRAME_STYLE_CONTRACT__;
    const overlayPromoted = slot.querySelector("micro-app-host")?.hasAttribute("data-micro-global-overlay") ?? false;
    await handle.dispose();
    await runtime.destroy();
    const remaining = slot.childElementCount;
    slot.remove();
    return { values, overlayPromoted, remaining };
  });
  await testInfo.attach("style-compatibility", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });
  expect(result.values).toMatchObject({
    remWidth: "40px",
    svgWidth: "40px",
    svgFill: "rgb(17, 85, 153)",
    nestedWidth: "40px",
    dynamicBeforeRemoval: "60px",
  });
  expect(result.values?.fontFamily).not.toContain("MFOPT Contract");
  expect(result.values?.dynamicAfterRemoval).not.toBe("60px");
  expect(result.overlayPromoted).toBe(true);
  expect(result.remaining).toBe(0);
});

import { expect, test } from "./sentry-network-guard";

test("counts HTML Entry subtree scans and computed-style reads", async ({ page }, testInfo) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  const result = await page.evaluate(async () => {
    const queryCounts: Record<string, number> = {};
    let queriedNodes = 0;
    let computedStyleReads = 0;
    const restorers: Array<() => void> = [];
    for (const prototype of [
      window.Document.prototype,
      window.DocumentFragment.prototype,
      window.Element.prototype,
      window.ShadowRoot.prototype,
    ]) {
      const native = prototype.querySelectorAll;
      Object.defineProperty(prototype, "querySelectorAll", {
        configurable: true,
        writable: true,
        value(this: ParentNode, selectors: string) {
          const result = native.call(this, selectors);
          queryCounts[selectors] = (queryCounts[selectors] ?? 0) + 1;
          queriedNodes += result.length;
          return result;
        },
      });
      restorers.push(() => Object.defineProperty(prototype, "querySelectorAll", {
        configurable: true, writable: true, value: native,
      }));
    }
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    Object.defineProperty(window, "getComputedStyle", {
      configurable: true,
      value(element: Element, pseudo?: string | null) {
        computedStyleReads += 1;
        return nativeGetComputedStyle(element, pseudo);
      },
    });
    restorers.push(() => Object.defineProperty(window, "getComputedStyle", {
      configurable: true, value: nativeGetComputedStyle,
    }));
    const snapshot = () => ({
      queryCalls: Object.values(queryCounts).reduce((total, count) => total + count, 0),
      wildcardCalls: queryCounts["*"] ?? 0,
      queriedNodes,
      computedStyleReads,
      queryCounts: { ...queryCounts },
    });
    const reset = () => {
      for (const key of Object.keys(queryCounts)) delete queryCounts[key];
      queriedNodes = 0;
      computedStyleReads = 0;
    };
    const slot = document.createElement("div");
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const entry = {
      type: "html" as const,
      url: `http://127.0.0.1:4375/component.html?run=style-scan-${crypto.randomUUID()}`,
      globalName: "MicroFrameBenchmarkHtml",
    };
    reset();
    const first = await runtime.mountApp({ name: "style-scan-first", entry, container: slot });
    const firstMount = snapshot();
    reset();
    await first.dispose();
    const firstDispose = snapshot();
    reset();
    const repeated = await runtime.mountApp({ name: "style-scan-repeated", entry, container: slot });
    const repeatedMount = snapshot();
    reset();
    await repeated.dispose();
    const repeatedDispose = snapshot();
    await runtime.destroy();
    const remaining = slot.childElementCount;
    slot.remove();
    for (const restore of restorers.reverse()) restore();
    return { firstMount, firstDispose, repeatedMount, repeatedDispose, remaining };
  });

  await testInfo.attach("style-scan", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });
  expect(result.remaining).toBe(0);
  expect(result.firstMount.queryCalls).toBeGreaterThan(0);
  expect(result.repeatedMount.queryCalls).toBeGreaterThan(0);
});

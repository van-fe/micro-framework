import { expect, test } from "./sentry-network-guard";

test("bounds HTML Entry reuse by Runtime, semantic key, invalidation, and failures", async ({ page }, testInfo) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  const result = await page.evaluate(async () => {
    const fixture = "http://127.0.0.1:4375";
    const counts = async (run: string): Promise<Record<string, number>> => {
      const response = await fetch(`${fixture}/stats?run=${encodeURIComponent(run)}`);
      return response.json() as Promise<Record<string, number>>;
    };
    const exercise = async (
      run: string,
      options: Parameters<NonNullable<typeof window.__createMicroFrameBenchmarkRuntime__>>[0],
      credentials: Array<RequestCredentials | undefined>,
    ) => {
      const slot = document.createElement("div");
      document.body.append(slot);
      const runtime = window.__createMicroFrameBenchmarkRuntime__!(options);
      for (const [index, policy] of credentials.entries()) {
        const handle = await runtime.mountApp({
          name: `${run}-${index}`,
          entry: {
            type: "html",
            url: `${fixture}/component.html?run=${encodeURIComponent(run)}`,
            globalName: "MicroFrameBenchmarkHtml",
            credentials: policy as "same-origin" | "include" | undefined,
          },
          container: slot,
        });
        await handle.dispose();
      }
      await runtime.destroy();
      const resources = await counts(run);
      const remaining = slot.childElementCount;
      slot.remove();
      return { resources, remaining };
    };

    const reused = await exercise(`cache-reuse-${crypto.randomUUID()}`, { storage: { persistent: false } }, [undefined, undefined]);
    const credentialIsolation = await exercise(
      `cache-credentials-${crypto.randomUUID()}`,
      { storage: { persistent: false } },
      ["same-origin", "include"],
    );
    const disabled = await exercise(
      `cache-disabled-${crypto.randomUUID()}`,
      { storage: { persistent: false }, loading: { entryCache: false } },
      [undefined, undefined],
    );

    const retryRun = `cache-retry-${crypto.randomUUID()}`;
    const retrySlot = document.createElement("div");
    document.body.append(retrySlot);
    const retryRuntime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const retryEntry = {
      type: "html" as const,
      url: `${fixture}/flaky.html?run=${encodeURIComponent(retryRun)}`,
      globalName: "MicroFrameBenchmarkHtml",
    };
    const firstFailure = await retryRuntime.mountApp({ name: `${retryRun}-first`, entry: retryEntry, container: retrySlot })
      .then(() => false, () => true);
    const recovered = await retryRuntime.mountApp({ name: `${retryRun}-second`, entry: retryEntry, container: retrySlot });
    await recovered.dispose();
    await retryRuntime.destroy();
    const retry = { firstFailure, resources: await counts(retryRun), remaining: retrySlot.childElementCount };
    retrySlot.remove();
    return { reused, credentialIsolation, disabled, retry };
  });

  await testInfo.attach("entry-cache", {
    body: Buffer.from(JSON.stringify({ browser: testInfo.project.name, ...result })),
    contentType: "application/json",
  });
  expect(result.reused).toEqual({ resources: { "/component.html": 1, "/component.js": 2 }, remaining: 0 });
  expect(result.credentialIsolation).toEqual({
    resources: { "/component.html": 2, "/component.js": 2 },
    remaining: 0,
  });
  expect(result.disabled).toEqual({ resources: { "/component.html": 2, "/component.js": 2 }, remaining: 0 });
  expect(result.retry).toEqual({
    firstFailure: true,
    resources: { "/flaky.html": 2, "/component.js": 1 },
    remaining: 0,
  });
});

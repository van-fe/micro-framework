import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

const entry = `
export function mount(props) { props.container.textContent = 'mounted'; }
export function unmount(props) { props.container.textContent = ''; }
`;

test.beforeEach(async ({ page }) => {
  await page.route("**/failure-entry.js", (route) => route.fulfill({
    contentType: "text/javascript", body: entry,
  }));
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
});

for (const keepAlive of [false, true]) {
  test(`cleans every application after a throwing unmount hook (keepAlive=${keepAlive})`, async ({ page }) => {
    const result = await page.evaluate(async (keepAlive) => {
      let hookCalls = 0;
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({
        storage: { persistent: false },
        hooks: { beforeUnmount(event) {
          hookCalls++;
          if (event.name === "broken") throw new Error("hook failed");
        } },
      });
      runtime.services.set("retained-service", {});
      const errors: string[] = [];
      runtime.errors.subscribe((event) => errors.push(event.phase));
      const slot = document.body.appendChild(document.createElement("div"));
      const handles = await Promise.all(["broken", "healthy"].map((name) => runtime.mountApp({
        name, container: slot, entry: { type: "module", url: new URL("/failure-entry.js", location.href).href }, keepAlive,
      })));
      const frames = [...slot.querySelectorAll("iframe")];
      const outcomes = await Promise.allSettled([runtime.destroy(), runtime.destroy()]);
      await runtime.destroy();
      return {
        outcomes: outcomes.map((outcome) => outcome.status),
        statuses: handles.map((handle) => handle.getStatus()),
        hosts: slot.querySelectorAll("micro-app-host").length,
        framesConnected: frames.some((frame) => frame.isConnected),
        services: runtime.services.names(), hookCalls, errors,
      };
    }, keepAlive);
    expect(result.outcomes).toEqual(["rejected", "rejected"]);
    expect(result.statuses).toEqual(["disposed", "disposed"]);
    expect(result.hosts).toBe(0);
    expect(result.framesConnected).toBe(false);
    expect(result.services).toEqual([]);
    expect(result.hookCalls).toBe(2);
    expect(result.errors).toContain(keepAlive ? "deactivate" : "unmount");
  });
}

for (const { prewarm, crossOrigin } of [
  { prewarm: false, crossOrigin: false }, { prewarm: true, crossOrigin: false },
  { prewarm: false, crossOrigin: true }, { prewarm: true, crossOrigin: true },
]) {
  test(`cancels pending props during destruction (prewarm=${prewarm}, crossOrigin=${crossOrigin})`, async ({ page }) => {
    const result = await page.evaluate(async ({ prewarm, crossOrigin }) => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 0 } });
      const slot = document.body.appendChild(document.createElement("div"));
      let started!: () => void;
      const supplied = new Promise<void>((resolve) => { started = resolve; });
      const registration = {
        name: "pending-props", container: slot,
        isolation: crossOrigin ? { mode: "cross-origin" as const } : undefined,
        entry: { type: "module" as const, url: new URL("/failure-entry.js", location.href).href },
        fallbackEntries: [{ type: "module" as const, url: new URL("/unused-entry.js", location.href).href }],
        props: () => { started(); return new Promise<Record<string, unknown>>(() => {}); },
      };
      let supplyCount = 0;
      const supply = registration.props;
      registration.props = () => { supplyCount++; return supply(); };
      const mounting = (prewarm ? runtime.prewarmApp(registration) : runtime.mountApp(registration)).catch(() => undefined);
      await supplied;
      await runtime.destroy();
      await mounting;
      return { hosts: slot.childElementCount, supplyCount };
    }, { prewarm, crossOrigin });
    expect(result).toEqual({ hosts: 0, supplyCount: 1 });
  });
}

test("times out a props supplier and removes its surface", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 20 } });
    const slot = document.body.appendChild(document.createElement("div"));
    const phases: string[] = [];
    runtime.errors.subscribe((event) => phases.push(event.phase));
    const error = await runtime.mountApp({
      name: "slow-props", container: slot,
      entry: { type: "module", url: new URL("/failure-entry.js", location.href).href },
      props: () => new Promise(() => {}),
    }).then(() => "unexpected success", (error: Error) => error.message);
    await runtime.destroy();
    return { error, hosts: slot.childElementCount, phases };
  });
  expect(result.error).toContain("slow-props.props exceeded 20ms");
  expect(result.hosts).toBe(0);
  expect(result.phases).toContain("mount");
});

for (const failure of ["throw", "timeout"]) {
  test(`reports failed updates and permits a clean remount (${failure})`, async ({ page }) => {
    await page.route("**/failure-entry.js", (route) => route.fulfill({
      contentType: "text/javascript", body: entry + `
      export function update(props) {
        if (props.fail) ${failure === "throw" ? "throw new Error('update failed')" : "return new Promise(() => {})"};
        props.container.textContent = props.title;
      }`,
    }));
    const result = await page.evaluate(async () => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { lifecycle: 100 } });
      const phases: string[] = [];
      runtime.errors.subscribe((event) => phases.push(event.phase));
      const slot = document.body.appendChild(document.createElement("div"));
      const handle = await runtime.mountApp({
        name: "failed-update", container: slot,
        entry: { type: "module", url: new URL("/failure-entry.js", location.href).href },
        props: { fail: false, title: "initial" },
      });
      const original = slot.querySelector("iframe")!;
      const rejected = await handle.update({ fail: true }).then(() => false, () => true);
      const failedStatus = handle.getStatus();
      const failedHosts = slot.childElementCount;
      await handle.mount();
      await handle.update({ title: "recovered" });
      const recovered = slot.querySelector("micro-app-host")!.shadowRoot!.textContent;
      const status = handle.getStatus();
      const freshFrame = slot.querySelector("iframe") !== original;
      await runtime.destroy();
      return { rejected, failedStatus, failedHosts, recovered, status, freshFrame, phases };
    });
    expect(result).toMatchObject({ rejected: true, failedStatus: "error", failedHosts: 0, status: "mounted", freshFrame: true, phases: ["update"] });
    expect(result.recovered).toContain("recovered");
  });
}

test("finishes destruction while an update is pending", async ({ page }) => {
  await page.route("**/failure-entry.js", (route) => route.fulfill({
    contentType: "text/javascript", body: entry + "export function update() { return new Promise(() => {}); }",
  }));
  const result = await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { lifecycle: 0 } });
    const slot = document.body.appendChild(document.createElement("div"));
    const handle = await runtime.mountApp({
      name: "pending-update", container: slot,
      entry: { type: "module", url: new URL("/failure-entry.js", location.href).href },
    });
    const updating = handle.update({}).then(() => false, () => true);
    await runtime.destroy();
    return { rejected: await updating, status: handle.getStatus(), hosts: slot.childElementCount };
  });
  expect(result).toEqual({ rejected: true, status: "disposed", hosts: 0 });
});

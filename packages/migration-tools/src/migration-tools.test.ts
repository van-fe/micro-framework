import { describe, expect, it } from "vitest";
import { MigrationPlanError, assertMigrationReady } from "./diagnostics";
import { planQiankunMigration } from "./qiankun";
import { planWujieMigration } from "./wujie";

describe("qiankun migration planning", () => {
  it("maps route registrations and preserves the source default prefetch behavior", () => {
    const plan = planQiankunMigration({
      applications: [{
        name: "orders",
        entry: "https://apps.example.com/orders/",
        container: "#orders",
        activeRule: "/orders",
        props: { tenant: "north" },
      }],
    });

    expect(plan.status).toBe("ready");
    assertMigrationReady(plan);
    expect(plan.output.registrations).toEqual([{
      name: "orders",
      entry: "https://apps.example.com/orders/",
      container: "#orders",
      activeWhen: "/orders",
      props: { tenant: "north" },
    }]);
    expect(plan.output.startOptions).toEqual({ preload: true });
  });

  it("keeps named prefetch targets and requires an explicit timing review", () => {
    const plan = planQiankunMigration({
      applications: [{ name: "orders", entry: "/orders/", container: "#app", activeRule: "/orders" }],
      startOptions: { prefetch: ["orders"], singular: true, sandbox: false },
    });

    expect(plan.status).toBe("review");
    if (plan.status === "blocked") throw new Error("expected a migration output");
    expect(plan.output.startOptions).toEqual({ preload: false, concurrency: "single" });
    expect(plan.output.prefetchAppNames).toEqual(["orders"]);
    expect(plan.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "QK_PREFETCH_LIST_TIMING", "QK_SANDBOX_SEMANTICS",
    ]));
  });

  it("blocks inline resource entries and custom loading hooks", () => {
    const plan = planQiankunMigration({
      applications: [{
        name: "orders",
        entry: { html: "<main>orders</main>", scripts: ["/orders.js"] },
        container: "#app",
        activeRule: "/orders",
      }],
      startOptions: { getTemplate: (html: string) => html },
    });

    expect(plan.status).toBe("blocked");
    expect(plan.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "QK_ENTRY_RESOURCE_OBJECT", "QK_GET_TEMPLATE",
    ]));
  });
});

describe("wujie migration planning", () => {
  it("merges setup and start options into a manual Runtime registration", () => {
    const plan = planWujieMigration({
      setup: { name: "profile", url: "https://apps.example.com/profile/", props: { locale: "zh-CN" } },
      start: { name: "profile", el: "#profile" },
      childLifecycle: "ready",
    });

    expect(plan.status).toBe("ready");
    if (plan.status === "blocked") throw new Error("expected a migration output");
    expect(plan.output.registration).toEqual({
      name: "profile",
      entry: "https://apps.example.com/profile/",
      container: "#profile",
      props: { locale: "zh-CN" },
    });
    expect(plan.output.mountMode).toBe("manual");
  });

  it("marks child lifecycle and route synchronization for review", () => {
    const plan = planWujieMigration({
      start: {
        name: "profile",
        url: "/profile/",
        el: "#profile",
        sync: true,
        beforeMount: () => undefined,
      },
    });

    expect(plan.status).toBe("review");
    if (plan.status === "blocked") throw new Error("expected a migration output");
    expect(plan.output.manualLifecycleHooks).toEqual(["beforeMount"]);
    expect(plan.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "WJ_CHILD_LIFECYCLE", "WJ_ROUTE_SYNC", "WJ_HOST_LIFECYCLES",
    ]));
  });

  it("maps keep-alive for review while source rewriting still blocks the plan", () => {
    const plan = planWujieMigration({
      start: {
        name: "profile",
        url: "/profile/",
        el: "#profile",
        alive: true,
        replace: (source) => source,
      },
      childLifecycle: "ready",
    });

    expect(plan.status).toBe("blocked");
    expect(plan.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "WJ_KEEP_ALIVE", "WJ_SOURCE_REPLACE",
    ]));
    expect(() => assertMigrationReady(plan)).toThrow(MigrationPlanError);
  });

  it("maps alive and preload execution to keepAlive plus Realm prewarming", () => {
    const plan = planWujieMigration({
      preload: { name: "profile", url: "/profile/", exec: true },
      start: { name: "profile", url: "/profile/", el: "#profile", alive: true },
      childLifecycle: "ready",
    });

    expect(plan.status).toBe("review");
    if (plan.status === "blocked") throw new Error("expected a migration output");
    expect(plan.output.registration).toMatchObject({ keepAlive: true });
    expect(plan.output.prewarmApplication).toBe(true);
    expect(plan.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "WJ_KEEP_ALIVE", "WJ_PRE_EXECUTION",
    ]));
  });
});

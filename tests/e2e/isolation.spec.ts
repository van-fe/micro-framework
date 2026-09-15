import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.log(`[browser:${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`[browser:pageerror] ${error.stack ?? error.message}`);
  });
});

test("executes the application in an isolated iframe Realm and renders into Shadow DOM", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vanilla-orders"]')!;
    const reactHost = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="react-dashboard"]')!;
    const vueHost = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')!;
    const vue2Host = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue2-console"]')!;
    const iframe = host.querySelector("iframe")!;
    const frameWindow = iframe.contentWindow as Window & typeof globalThis & {
      __realmCollision__?: string;
      __vanillaBootstrapCount__?: number;
      __vanillaInstanceId__?: string;
      __vanillaModuleCount__?: number;
      __persistentBootstrapCount__?: number;
      __visualSurfaceProbe__?: {
        containerIsBody: boolean;
        overlayIsDedicated: boolean;
      };
      __rpcProbe__?: {
        inputValue: string;
        receivedValue: string;
        mutatedValue: string;
      };
      __capabilityProbe__?: {
        features?: { ok: boolean; value?: Record<string, boolean> };
        activation?: { ok: boolean };
        deniedPopup?: { ok: boolean; error?: { code?: string } };
      };
    };
    Reflect.set(frameWindow.Array.prototype, "realmOnly", "vanilla");
    const card = host.shadowRoot!.querySelector<HTMLElement>("#vanilla-root");
    const frameScript = frameWindow.document.createElement("script");
    const nativeQuery = frameWindow.Document.prototype.querySelector.bind(frameWindow.document);
    const nativeQueryAll = frameWindow.Document.prototype.querySelectorAll.bind(frameWindow.document);
    const importMap = nativeQuery<HTMLScriptElement>('head script[type="importmap"]');
    const modulePreloads = [...nativeQueryAll<HTMLLinkElement>('head link[rel="modulepreload"]')]
      .map((link) => link.href);
    const reactFrameWindow = reactHost.querySelector("iframe")!.contentWindow as
      Window & typeof globalThis;
    return {
      hostGlobal: (window as Window & { __realmCollision__?: string }).__realmCollision__,
      appGlobal: frameWindow.__realmCollision__,
      bootstrapCount: frameWindow.__vanillaBootstrapCount__,
      instanceId: frameWindow.__vanillaInstanceId__,
      moduleCount: frameWindow.__vanillaModuleCount__,
      persistentBootstrapCount: frameWindow.__persistentBootstrapCount__,
      visualSurfaceProbe: frameWindow.__visualSurfaceProbe__,
      rpcProbe: frameWindow.__rpcProbe__,
      rpcHostState: (window as Window & {
        __rpcHostState__?: { inputValue?: string; resultValue?: string };
      }).__rpcHostState__,
      cardText: card?.textContent,
      hasHtmlTemplate: Boolean(host.shadowRoot!.querySelector("[data-html-entry]")),
      cardOwnerIsHost: card?.ownerDocument === document,
      cardIsHostElement: card instanceof HTMLElement,
      cardIsFrameElement: card instanceof frameWindow.HTMLElement,
      cardConstructorIsFrameElement: card?.constructor === frameWindow.HTMLElement,
      frameScriptIsFrameElement: frameScript instanceof frameWindow.HTMLElement,
      frameScriptIsHostElement: frameScript instanceof HTMLElement,
      hostPrototypeValue: Reflect.get(Array.prototype, "realmOnly"),
      reactPrototypeValue: Reflect.get(
        reactFrameWindow.Array.prototype,
        "realmOnly",
      ),
      documentQueryEscaped: frameWindow.document.querySelector("#host-title") !== null,
      capabilityProbe: frameWindow.__capabilityProbe__,
      visualDeviceScaleMatches: frameWindow.devicePixelRatio === window.devicePixelRatio,
      visualViewportMatches: frameWindow.innerWidth === window.innerWidth
        && frameWindow.innerHeight === window.innerHeight,
      visualVisibilityMatches: frameWindow.document.visibilityState === document.visibilityState,
      hostTitleColor: getComputedStyle(document.querySelector("#host-title")!).color,
      reactText: reactHost.shadowRoot!.querySelector("#react-root")?.textContent,
      reactPortal: reactHost.shadowRoot!.querySelector("#react-portal")?.textContent,
      reactRealm: (reactHost.querySelector("iframe")!.contentWindow as Window & { __reactRealm__?: string }).__reactRealm__,
      vueText: vueHost.shadowRoot!.querySelector("#vue-root")?.textContent,
      vueTeleport: vueHost.shadowRoot!.querySelector("#vue-teleport")?.textContent,
      vueRealm: (vueHost.querySelector("iframe")!.contentWindow as Window & { __vueRealm__?: string }).__vueRealm__,
      vue2Text: vue2Host.shadowRoot!.querySelector("#vue2-root")?.textContent,
      vue2Realm: (vue2Host.querySelector("iframe")!.contentWindow as Window & { __vue2Realm__?: string }).__vue2Realm__,
      hasAntDesign: Boolean(reactHost.shadowRoot!.querySelector(".ant-btn")),
      hasElementPlus: Boolean(vueHost.shadowRoot!.querySelector(".el-button")),
      hasElementUi: Boolean(vue2Host.shadowRoot!.querySelector(".el-button")),
      realmCount: document.querySelectorAll("micro-app-host iframe").length,
      importMap: JSON.parse(importMap?.textContent ?? "null"),
      modulePreloads,
    };
  });

  expect(result.hostGlobal).toBe("host");
  expect(result.appGlobal).toBe("micro-app");
  expect(result.bootstrapCount).toBe(1);
  expect(result.instanceId).toMatch(/^vanilla-orders:/);
  expect(result.moduleCount).toBe(1);
  expect(result.persistentBootstrapCount).toBe(1);
  expect(result.visualSurfaceProbe).toEqual({
    containerIsBody: true,
    overlayIsDedicated: true,
  });
  expect(result.rpcProbe).toEqual({
    inputValue: "application-input",
    receivedValue: "host-result",
    mutatedValue: "application-mutated",
  });
  expect(result.rpcHostState).toEqual({
    inputValue: "host-received",
    resultValue: "host-result",
  });
  expect(result.cardText).toContain("Orders application");
  expect(result.hasHtmlTemplate).toBe(true);
  expect(result.cardOwnerIsHost).toBe(true);
  expect(result.cardIsHostElement).toBe(true);
  expect(result.cardIsFrameElement).toBe(true);
  expect(result.cardConstructorIsFrameElement).toBe(false);
  expect(result.frameScriptIsFrameElement).toBe(true);
  expect(result.frameScriptIsHostElement).toBe(false);
  expect(result.hostPrototypeValue).toBeUndefined();
  expect(result.reactPrototypeValue).toBeUndefined();
  expect(result.documentQueryEscaped).toBe(false);
  expect(result.capabilityProbe?.features?.ok).toBe(true);
  expect(result.capabilityProbe?.features?.value).toMatchObject({
    shadowDom: true,
    modules: true,
    abortController: true,
  });
  expect(result.capabilityProbe?.activation?.ok).toBe(true);
  expect(result.capabilityProbe?.deniedPopup).toMatchObject({
    ok: false,
    error: { code: "denied" },
  });
  expect(result.visualDeviceScaleMatches).toBe(true);
  expect(result.visualViewportMatches).toBe(true);
  expect(result.visualVisibilityMatches).toBe(true);
  expect(result.hostTitleColor).not.toBe("rgb(220, 38, 38)");
  expect(result.hostTitleColor).not.toBe("rgb(34, 197, 94)");
  expect(result.hostTitleColor).not.toBe("rgb(59, 130, 246)");
  expect(result.reactText).toContain("React dashboard");
  expect(result.reactPortal).toContain("React portal stays inside");
  expect(result.reactRealm).toBe("react-iframe");
  expect(result.vueText).toContain("Vue profile");
  expect(result.vueTeleport).toContain("Vue Teleport stays inside");
  expect(result.vueRealm).toBe("vue-iframe");
  expect(result.vue2Text).toContain("Vue 2 console");
  expect(result.vue2Realm).toBe("vue2-iframe");
  expect(result.hasAntDesign).toBe(true);
  expect(result.hasElementPlus).toBe(true);
  expect(result.hasElementUi).toBe(true);
  expect(result.realmCount).toBe(4);
  expect(result.importMap).toEqual({
    imports: {
      "@micro-framework/demo-shared": "http://127.0.0.1:5174/src/shared-marker.ts",
    },
  });
  expect(result.modulePreloads).toContain("http://127.0.0.1:5174/src/shared-marker.ts");
  expect(result.modulePreloads.some((href) => {
    const url = new URL(href);
    return url.origin === "http://127.0.0.1:5174" && url.pathname === "/src/lifecycle.ts";
  })).toBe(false);
});

test("keeps document.write optional and warns without loading its package", async ({ page }) => {
  const requests: string[] = [];
  const warnings: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");
  const result = await page.evaluate(() => {
    const host = document.querySelector('micro-app-host[data-micro-app="vanilla-orders"]')!;
    const frame = host.querySelector("iframe")!.contentWindow!;
    const originalDocument = frame.document;
    const originalRoot = host.shadowRoot!.querySelector("#vanilla-root");
    const write = frame.document.write;
    write.call(frame.document, '<b id="disabled-write">ignored</b>');
    frame.document.write("again");
    return {
      written: Boolean(host.shadowRoot!.querySelector("#disabled-write")),
      sameDocument: frame.document === originalDocument,
      sameRoot: host.shadowRoot!.querySelector("#vanilla-root") === originalRoot,
    };
  });
  expect(result).toEqual({ written: false, sameDocument: true, sameRoot: true });
  const writeWarnings = warnings.filter((message) => message.includes("document.write() was blocked"));
  expect(writeWarnings).toHaveLength(1);
  expect(writeWarnings[0]).toContain("@micro-framework/document-write");
  expect(writeWarnings[0]).toContain("documentWrite: installDocumentWrite");
  expect(requests.filter((url) => url.includes("document-write") || url.includes("parse5"))).toEqual([]);
});

test("supports explicitly enabled document.write in every adapter while retaining application and host isolation", async ({ page }) => {
  await page.goto("/?documentWrite=true");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(() => {
    const applications = [
      ["vanilla-orders", "#vanilla-root"],
      ["react-dashboard", "#react-root"],
      ["vue-profile", "#vue-root"],
      ["vue2-console", "#vue2-root"],
    ] as const;
    const originalWrite = Document.prototype.write;
    const probes = applications.map(([name, selector]) => {
      const host = document.querySelector<HTMLElement>(`micro-app-host[data-micro-app="${name}"]`)!;
      const iframe = host.querySelector("iframe")!;
      const frameWindow = iframe.contentWindow as Window & { __runtimeDocumentWrite?: string };
      const root = host.shadowRoot!.querySelector(selector);
      frameWindow.document.write(`<section id="adapter-written"><script>
        window.__runtimeDocumentWrite = ${JSON.stringify(name)};
        document.write('<span id="adapter-nested">' + window.__runtimeDocumentWrite + '</span>');
      </script></section>`);
      frameWindow.document.writeln('<p id="adapter-writeln">written line</p>');
      return {
        name,
        global: frameWindow.__runtimeDocumentWrite,
        nested: host.shadowRoot!.querySelector("#adapter-nested")?.textContent,
        line: host.shadowRoot!.querySelector("#adapter-writeln")?.textContent,
        rootRetained: host.shadowRoot!.querySelector(selector) === root,
        sameRealm: iframe.contentWindow === frameWindow,
      };
    });
    return {
      probes,
      hostGlobal: Reflect.get(window, "__runtimeDocumentWrite"),
      escapedMarkup: document.querySelector("#adapter-written") !== null,
      hostPrototypeRetained: Document.prototype.write === originalWrite,
    };
  });

  expect(result.probes).toEqual([
    "vanilla-orders", "react-dashboard", "vue-profile", "vue2-console",
  ].map((name) => ({
    name, global: name, nested: name, line: "written line", rootRetained: true, sameRealm: true,
  })));
  expect(result.hostGlobal).toBeUndefined();
  expect(result.escapedMarkup).toBe(false);
  expect(result.hostPrototypeRetained).toBe(true);
});

test("keeps the React chart endpoint circular in a stretched plot", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const dimensions = await page.evaluate(() => {
    const shadowRoot = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!.shadowRoot!;
    const plot = shadowRoot.querySelector<HTMLElement>(".chart-plot")!.getBoundingClientRect();
    const endpoint = shadowRoot.querySelector<HTMLElement>("[data-chart-endpoint]")!.getBoundingClientRect();
    return {
      endpointHeight: endpoint.height,
      endpointWidth: endpoint.width,
      plotAspectRatio: plot.width / plot.height,
    };
  });

  expect(dimensions.plotAspectRatio).toBeGreaterThan(2);
  expect(dimensions.endpointWidth).toBeGreaterThan(0);
  expect(Math.abs(dimensions.endpointWidth - dimensions.endpointHeight)).toBeLessThanOrEqual(0.25);
});

test("covers the host viewport by default while keeping overlay DOM application-owned", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.evaluate(() => {
    const shadow = (name: string) => document.querySelector<HTMLElement>(
      `micro-app-host[data-micro-app="${name}"]`,
    )!.shadowRoot!;

    const vanilla = shadow("vanilla-orders");
    vanilla.querySelector<HTMLButtonElement>("[data-order-id]")!.click();
    vanilla.querySelector<HTMLButtonElement>("[data-resolve]")!.click();
    const react = shadow("react-dashboard");
    react.querySelector<HTMLButtonElement>("[data-open-overlay='react']")!.click();
    const explicitContainer = document.createElement("div");
    explicitContainer.dataset.explicitOverlayContainer = "true";
    explicitContainer.style.cssText = "position:relative;width:320px;height:180px";
    const localOverlay = document.createElement("div");
    localOverlay.dataset.localOverlay = "true";
    localOverlay.style.cssText = "position:absolute;inset:0";
    explicitContainer.append(localOverlay);
    react.querySelector("#react-root")!.append(explicitContainer);
    const vue = shadow("vue-profile");
    vue.querySelector<HTMLButtonElement>("[data-open-overlay='vue3-dialog']")!.click();
    vue.querySelector<HTMLButtonElement>("[data-open-overlay='vue3-drawer']")!.click();
    shadow("vue2-console").querySelector<HTMLButtonElement>("[data-open-overlay='vue2']")!.click();
  });

  await expect.poll(() => page.evaluate(() => {
    const shadow = (name: string) => document.querySelector<HTMLElement>(
      `micro-app-host[data-micro-app="${name}"]`,
    )!.shadowRoot!;
    const vanilla = shadow("vanilla-orders");
    const react = shadow("react-dashboard");
    const vue = shadow("vue-profile");
    const vue2 = shadow("vue2-console");
    const vueOverlays = [...vue.querySelectorAll<HTMLElement>(".vue-scoped-overlay")];
    const vue2Wrapper = vue2.querySelector<HTMLElement>(".el-dialog__wrapper");
    const reactWrap = react.querySelector<HTMLElement>(".ant-modal-wrap");
    const vanillaDialog = vanilla.querySelector<HTMLDialogElement>("dialog[data-overlay-kind='vanilla']");
    const coversViewport = (element: HTMLElement | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.left <= 1
        && rect.top <= 1
        && rect.right >= window.innerWidth - 1
        && rect.bottom >= window.innerHeight - 1;
    };
    const centeredInViewport = (element: HTMLElement | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) <= 2
        && Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) <= 2;
    };
    const explicitContainer = react.querySelector<HTMLElement>("[data-explicit-overlay-container]");
    const localOverlay = react.querySelector<HTMLElement>("[data-local-overlay]");
    const followsExplicitContainer = (() => {
      if (!explicitContainer || !localOverlay) return false;
      const containerRect = explicitContainer.getBoundingClientRect();
      const overlayRect = localOverlay.getBoundingClientRect();
      return Math.abs(containerRect.left - overlayRect.left) <= 1
        && Math.abs(containerRect.top - overlayRect.top) <= 1
        && Math.abs(containerRect.width - overlayRect.width) <= 1
        && Math.abs(containerRect.height - overlayRect.height) <= 1;
    })();

    return {
      vanillaOpen: vanillaDialog?.hasAttribute("open"),
      vanillaCentered: centeredInViewport(vanillaDialog),
      reactModal: Boolean(reactWrap),
      reactCoversViewport: coversViewport(reactWrap),
      explicitContainerRespected: followsExplicitContainer,
      vueDialog: Boolean(vue.querySelector("[data-overlay-kind='vue3-dialog']")),
      vueDrawer: Boolean(vue.querySelector("[data-overlay-kind='vue3-drawer']")),
      vueVisibleOverlays: vueOverlays.filter((overlay) => getComputedStyle(overlay).display !== "none").length,
      vueOverlaysCoverViewport: vueOverlays
        .filter((overlay) => getComputedStyle(overlay).display !== "none")
        .every(coversViewport),
      vueStatus: vue.querySelector("#vue-teleport")?.textContent,
      vue2Dialog: Boolean(vue2Wrapper && getComputedStyle(vue2Wrapper).display !== "none"),
      vue2CoversViewport: coversViewport(vue2Wrapper),
      hostLeaks: document.body.querySelectorAll(
        ":scope > .ant-modal-root, :scope > .el-overlay, :scope > .el-dialog__wrapper, :scope > dialog[data-overlay-kind]",
      ).length,
    };
  })).toEqual({
    vanillaOpen: true,
    vanillaCentered: true,
    reactModal: true,
    reactCoversViewport: true,
    explicitContainerRespected: true,
    vueDialog: true,
    vueDrawer: true,
    vueVisibleOverlays: 2,
    vueOverlaysCoverViewport: true,
    vueStatus: expect.stringContaining("2"),
    vue2Dialog: true,
    vue2CoversViewport: true,
    hostLeaks: 0,
  });
});

test("keeps component-library tooltips and menus local, interactive, and disposable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const popupContract = async (
    application: string,
    triggerSelector: string,
    markerSelector: string,
    rootSelector: string,
  ) => page.evaluate(({ application, triggerSelector, markerSelector, rootSelector }) => {
    const host = document.querySelector<HTMLElement>(
      `micro-app-host[data-micro-app="${application}"]`,
    )!;
    const trigger = host.shadowRoot!.querySelector<HTMLElement>(triggerSelector)!;
    const marker = host.shadowRoot!.querySelector<HTMLElement>(markerSelector)!;
    const popup = marker.matches(rootSelector)
      ? marker
      : marker.closest<HTMLElement>(rootSelector)!;
    const rect = popup.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const horizontalGap = Math.max(triggerRect.left - rect.right, rect.left - triggerRect.right, 0);
    const verticalGap = Math.max(triggerRect.top - rect.bottom, rect.top - triggerRect.bottom, 0);
    return {
      insideApplicationShadow: popup.getRootNode() === host.shadowRoot,
      ownedByHostDocument: popup.ownerDocument === document,
      leakedToHostTree: document.querySelector(markerSelector) !== null,
      promotedAsModal: popup.hasAttribute("data-micro-global-overlay-root"),
      hostPromotedAsModal: host.hasAttribute("data-micro-global-overlay"),
      compact: rect.width > 0
        && rect.height > 0
        && rect.width < window.innerWidth / 2
        && rect.height < window.innerHeight / 2,
      anchored: Math.hypot(horizontalGap, verticalGap) <= 160,
      visibleInViewport: rect.right > 0
        && rect.bottom > 0
        && rect.left < window.innerWidth
        && rect.top < window.innerHeight,
      rect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }, { application, triggerSelector, markerSelector, rootSelector });
  const expectedPopupContract = {
    insideApplicationShadow: true,
    ownedByHostDocument: true,
    leakedToHostTree: false,
    promotedAsModal: false,
    hostPromotedAsModal: false,
    compact: true,
    anchored: true,
    visibleInViewport: true,
  };

  await page.locator('[data-open-popup="react-tooltip"]').hover();
  await expect(page.locator('[data-overlay-kind="react-tooltip"]')).toBeVisible();
  await expect.poll(() => popupContract(
    "react-dashboard",
    '[data-open-popup="react-tooltip"]',
    '[data-overlay-kind="react-tooltip"]',
    ".ant-tooltip",
  )).toMatchObject(expectedPopupContract);
  await page.mouse.move(1, 1);
  await expect(page.locator('[data-overlay-kind="react-tooltip"]')).toBeHidden();

  await page.locator('[data-open-popup="react-menu"]').click();
  await expect(page.locator('[data-overlay-kind="react-menu-item"]')).toBeVisible();
  await expect.poll(() => popupContract(
    "react-dashboard",
    '[data-open-popup="react-menu"]',
    '[data-overlay-kind="react-menu-item"]',
    ".ant-dropdown",
  )).toMatchObject(expectedPopupContract);
  await page.locator('[data-overlay-kind="react-menu-item"]').click();
  await expect(page.locator("[data-react-popup-feedback]")).toContainText("预测偏差说明已准备");

  await page.locator('[data-open-popup="vue3-tooltip"]').hover();
  await expect(page.locator(".vue-contract-tooltip")).toBeVisible();
  await expect.poll(() => popupContract(
    "vue-profile",
    '[data-open-popup="vue3-tooltip"]',
    ".vue-contract-tooltip",
    ".el-popper",
  )).toMatchObject(expectedPopupContract);
  await page.mouse.move(1, 1);
  await expect(page.locator(".vue-contract-tooltip")).toBeHidden();

  await page.locator('[data-open-popup="vue3-menu"]').click();
  await expect(page.locator('[data-overlay-kind="vue3-menu-item"]')).toBeVisible();
  await expect.poll(() => popupContract(
    "vue-profile",
    '[data-open-popup="vue3-menu"]',
    '[data-overlay-kind="vue3-menu-item"]',
    ".el-popper",
  )).toMatchObject(expectedPopupContract);
  await page.locator('[data-overlay-kind="vue3-menu-item"]').click();
  await expect(page.locator(".action-feedback")).toContainText("客户备注已准备");

  await page.locator('[data-open-popup="vue2-tooltip"]').hover();
  await expect(page.locator(".vue2-contract-tooltip")).toBeVisible();
  await expect.poll(() => popupContract(
    "vue2-console",
    '[data-open-popup="vue2-tooltip"]',
    ".vue2-contract-tooltip",
    ".el-tooltip__popper",
  )).toMatchObject(expectedPopupContract);
  await page.mouse.move(1, 1);
  await expect(page.locator(".vue2-contract-tooltip")).toBeHidden();

  await page.locator('[data-open-popup="vue2-menu"]').click();
  await expect(page.locator('[data-overlay-kind="vue2-menu-item"]')).toBeVisible();
  await expect.poll(() => popupContract(
    "vue2-console",
    '[data-open-popup="vue2-menu"]',
    '[data-overlay-kind="vue2-menu-item"]',
    ".el-dropdown-menu",
  )).toMatchObject(expectedPopupContract);
  await page.locator('[data-overlay-kind="vue2-menu-item"]').click();
  await expect(page.locator("[data-vue2-popup-feedback]")).toContainText("迁移依赖检查已完成");

  await page.locator('[data-open-popup="react-menu"]').click();
  await page.locator('[data-open-popup="vue3-menu"]').click();
  await page.locator('[data-open-popup="vue2-menu"]').click();
  await page.evaluate(async () => {
    await (window as Window & {
      __microFrameRuntime__: { destroy(): Promise<void> };
    }).__microFrameRuntime__.destroy();
  });
  await expect(page.locator("micro-app-host")).toHaveCount(0);
  expect(await page.locator(
    '.ant-tooltip,.ant-dropdown,.el-popper,.el-tooltip__popper,.el-dropdown-menu',
  ).count()).toBe(0);
});

test("bridges component-library motion and restores host interaction after close", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const vueTokens = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue-profile"]',
    )!;
    const app = host.shadowRoot!.querySelector<HTMLElement>(".customer-app")!;
    const compatibilityStyle = host.shadowRoot!.querySelector<HTMLTemplateElement>(
      "[data-micro-document-tokens]",
    );
    return {
      duration: getComputedStyle(app).getPropertyValue("--el-transition-duration").trim(),
      fastDuration: getComputedStyle(app).getPropertyValue("--el-transition-duration-fast").trim(),
      hasCompatibilityRule: compatibilityStyle?.textContent?.includes("--el-transition-duration:.3s") ?? false,
    };
  });
  expect(vueTokens).toEqual({
    duration: ".3s",
    fastDuration: ".2s",
    hasCompatibilityRule: true,
  });

  await page.evaluate(() => {
    for (const name of ["react-dashboard", "vue-profile", "vue2-console"]) {
      const host = document.querySelector<HTMLElement>(`micro-app-host[data-micro-app="${name}"]`)!;
      host.dataset.motionEvents = "";
      host.dataset.motionTimeline = "[]";
      for (const eventName of [
        "animationstart",
        "animationend",
        "animationcancel",
        "transitionstart",
        "transitionend",
        "transitioncancel",
      ]) {
        host.shadowRoot!.addEventListener(eventName, (event) => {
          const motionEvent = event as AnimationEvent & TransitionEvent;
          host.dataset.motionEvents += [
            event.type,
            motionEvent.animationName || motionEvent.propertyName || "unknown",
          ].join(":") + "|";
          const timeline = JSON.parse(host.dataset.motionTimeline ?? "[]") as Array<Record<string, unknown>>;
          timeline.push({
            type: event.type,
            name: motionEvent.animationName || motionEvent.propertyName || "unknown",
            at: performance.now(),
          });
          host.dataset.motionTimeline = JSON.stringify(timeline);
        }, true);
      }
    }
  });

  await page.locator("[data-open-overlay='react']").click();
  await expect(page.locator(".ant-modal-wrap")).toBeVisible();
  await expect(page.locator('micro-app-host[data-micro-app="react-dashboard"]')).toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );
  await page.locator(".ant-modal-close").click();
  await expect.poll(() => page.evaluate(() =>
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="react-dashboard"]')
      ?.dataset.motionEvents ?? "",
  )).toContain("antZoomOut");
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!.shadowRoot!;
    return [...shadow.querySelectorAll<HTMLElement>(".ant-modal-mask,.ant-modal-wrap")].flatMap((element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return [];
      return [{
        className: element.className,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
      }];
    });
  })).toEqual([]);
  await expect(page.locator('micro-app-host[data-micro-app="react-dashboard"]')).not.toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );

  await page.locator("[data-open-overlay='vue3-dialog']").click();
  await expect.poll(() => page.evaluate(() =>
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')
      ?.dataset.motionEvents ?? "",
  )).toContain("animationstart:modal-fade-in");
  await expect.poll(() => page.evaluate(() =>
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')
      ?.dataset.motionEvents ?? "",
  )).toMatch(/animation(?:end|cancel):modal-fade-in/);
  const vueDialogMotion = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')!;
    const timeline = JSON.parse(host.dataset.motionTimeline ?? "[]") as Array<{
      type: string;
      name: string;
      at: number;
    }>;
    const start = timeline.find((event) =>
      event.type === "animationstart" && event.name === "modal-fade-in"
    );
    const terminal = timeline.find((event) =>
      (event.type === "animationend" || event.type === "animationcancel")
        && event.name === "modal-fade-in"
    );
    const root = host.shadowRoot!.querySelector<HTMLElement>(".vue-scoped-overlay.el-modal-dialog");
    return {
      duration: start && terminal ? terminal.at - start.at : 0,
      terminal: terminal?.type,
      transitionClassRemaining: root?.className.includes("dialog-fade-enter-") ?? false,
    };
  });
  const expectedVueDurationMs = vueTokens.duration.endsWith("ms")
    ? Number.parseFloat(vueTokens.duration)
    : Number.parseFloat(vueTokens.duration) * 1_000;
  expect(vueDialogMotion.duration).toBeGreaterThanOrEqual(expectedVueDurationMs - 50);
  expect(vueDialogMotion.terminal).toMatch(/^animation(?:end|cancel)$/);
  expect(vueDialogMotion.transitionClassRemaining).toBe(false);
  const vueDialogLayout = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')!;
    const dialog = host.shadowRoot!.querySelector<HTMLElement>("[role='dialog']");
    const globalRoot = host.shadowRoot!.querySelector<HTMLElement>("[data-micro-global-overlay-root]");
    const ancestors: Array<Record<string, unknown>> = [];
    let candidate: HTMLElement | null = dialog;
    while (candidate) {
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      ancestors.push({
        className: candidate.className,
        position: style.position,
        display: style.display,
        opacity: style.opacity,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      });
      candidate = candidate.parentElement;
    }
    const globalRect = globalRoot?.getBoundingClientRect();
    return {
      elevated: host.hasAttribute("data-micro-global-overlay"),
      globalRoot: globalRect ? {
        left: Math.round(globalRect.left),
        top: Math.round(globalRect.top),
        right: Math.round(globalRect.right),
        bottom: Math.round(globalRect.bottom),
      } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      ancestors,
    };
  });
  expect(vueDialogLayout, JSON.stringify(vueDialogLayout.ancestors, null, 2)).toMatchObject({
    elevated: true,
    globalRoot: {
      left: 0,
      top: 0,
      right: vueDialogLayout.viewport.width,
      bottom: vueDialogLayout.viewport.height,
    },
  });
  await page.locator(".vue-scoped-overlay .el-dialog__headerbtn").click();
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue-profile"]',
    )!.shadowRoot!;
    const dialog = shadow.querySelector<HTMLElement>("[data-overlay-kind='vue3-dialog']");
    const overlay = dialog?.closest<HTMLElement>(".vue-scoped-overlay");
    return !overlay || getComputedStyle(overlay).display === "none";
  })).toBe(true);
  await expect(page.locator('micro-app-host[data-micro-app="vue-profile"]')).not.toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );

  await page.evaluate(() => {
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')!
      .dataset.motionEvents = "";
  });
  await page.locator("[data-open-overlay='vue3-drawer']").click();
  await expect(page.locator('micro-app-host[data-micro-app="vue-profile"]')).toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );
  await expect.poll(() => page.evaluate(() =>
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')
      ?.dataset.motionEvents ?? "",
  )).toContain("transitionstart:transform");
  await expect.poll(() => page.evaluate(() =>
    document.querySelector<HTMLElement>('micro-app-host[data-micro-app="vue-profile"]')
      ?.dataset.motionEvents ?? "",
  )).toContain("transitionend:transform");
  await page.locator(".vue-scoped-overlay .el-drawer__close-btn").click();
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue-profile"]',
    )!.shadowRoot!;
    const drawer = shadow.querySelector<HTMLElement>("[data-overlay-kind='vue3-drawer']");
    const overlay = drawer?.closest<HTMLElement>(".vue-scoped-overlay");
    return !overlay || getComputedStyle(overlay).display === "none";
  })).toBe(true);
  await expect(page.locator('micro-app-host[data-micro-app="vue-profile"]')).not.toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );

  await page.locator("[data-open-overlay='vue2']").click();
  await expect(page.locator('micro-app-host[data-micro-app="vue2-console"]')).toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );
  await expect(page.locator(".el-dialog__wrapper [data-overlay-kind='vue2']")).toBeVisible();
  await page.locator(".el-dialog__wrapper .el-dialog__headerbtn").click();
  await expect(page.locator(".el-dialog__wrapper [data-overlay-kind='vue2']")).toBeHidden();
  await expect(page.locator('micro-app-host[data-micro-app="vue2-console"]')).not.toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );

  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!;
    const localContainer = document.createElement("div");
    localContainer.style.cssText = "position:relative;width:240px;height:120px";
    const localDialog = document.createElement("div");
    localDialog.setAttribute("role", "dialog");
    localDialog.style.cssText = "position:absolute;inset:0";
    localContainer.append(localDialog);
    host.shadowRoot!.querySelector("#react-root")!.append(localContainer);
  });
  await expect(page.locator('micro-app-host[data-micro-app="react-dashboard"]')).not.toHaveAttribute(
    "data-micro-global-overlay",
    "",
  );

  await page.locator("#refresh-workspace").click();
  await expect(page.locator("#gmv-value")).toHaveText("$1.86M");
});

test("keeps viewport alignment stable during Vue 2 dialog enter motion", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const wrapperTopSamples = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue2-console"]',
    )!;
    const shadowRoot = host.shadowRoot!;
    shadowRoot.querySelector<HTMLButtonElement>("[data-open-overlay='vue2']")!.click();

    return await new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      const startedAt = performance.now();
      const sample = (): void => {
        const wrapper = shadowRoot.querySelector<HTMLElement>(".el-dialog__wrapper");
        if (wrapper) samples.push(wrapper.getBoundingClientRect().top);
        if (performance.now() - startedAt >= 450) resolve(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  const frameDeltas = wrapperTopSamples.slice(1).map((top, index) =>
    top - wrapperTopSamples[index]!,
  );
  expect(wrapperTopSamples.length).toBeGreaterThan(10);
  expect(Math.min(...frameDeltas)).toBeGreaterThanOrEqual(-2);
  expect(wrapperTopSamples.at(-1)).toBeCloseTo(0, 0);
});

test("schedules animation work through the visible host Window", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const scheduled = await page.evaluate(async () => {
    const frameWindow = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!.querySelector("iframe")!.contentWindow!;
    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => resolve(false), 1_000);
      frameWindow.requestAnimationFrame(() => {
        clearTimeout(timeoutId);
        resolve(true);
      });
    });
  });

  expect(scheduled).toBe(true);
});

test("coordinates business filters while each micro application keeps local interaction state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.locator("#locale-filter").selectOption("en-US");
  await page.locator("#market-filter").selectOption("Europe");
  await expect.poll(() => page.evaluate(() => {
    const texts = ["vanilla-orders", "react-dashboard", "vue-profile", "vue2-console"].map((name) => {
      const host = document.querySelector<HTMLElement>(`micro-app-host[data-micro-app="${name}"]`)!;
      return host.shadowRoot?.textContent ?? "";
    });
    return texts.every((text) => text.includes("Europe"));
  })).toBe(true);

  await page.evaluate(() => {
    const vanillaHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!;
    const reactHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!;
    const vueHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue-profile"]',
    )!;

    vanillaHost.shadowRoot!.querySelector<HTMLButtonElement>('[data-filter="risk"]')!.click();
    reactHost.shadowRoot!.querySelectorAll<HTMLButtonElement>(".micro-period button")[1]!.click();
    vueHost.shadowRoot!.querySelectorAll<HTMLButtonElement>(".customer-list > button")[1]!.click();
  });

  await expect.poll(() => page.evaluate(() => {
    const vanillaHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!;
    const reactHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="react-dashboard"]',
    )!;
    const vueHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vue-profile"]',
    )!;
    return {
      visibleOrders: [...vanillaHost.shadowRoot!.querySelectorAll<HTMLElement>("[data-order-state]")]
        .filter((row) => !row.hidden)
        .map((row) => row.dataset.orderState),
      reactPeriod: reactHost.shadowRoot!.querySelector(".micro-period .is-active")?.textContent,
      selectedCustomer: vueHost.shadowRoot!.querySelector(".account-detail header strong")?.textContent,
    };
  })).toEqual({
    visibleOrders: ["risk", "risk"],
    reactPeriod: "7d",
    selectedCustomer: "Aster & Co.",
  });
});

test("gives two instances of the same module independent globals and module state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const slot = document.createElement("div");
    slot.id = "second-vanilla-slot";
    document.body.append(slot);
    const handle = await window.__microFrameRuntime__!.mountApp({
      name: "vanilla-orders-copy",
      entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
      container: slot,
      props: { title: "Second orders application" },
    });
    window.__manualAppHandle__ = handle;

    const firstFrame = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!.querySelector("iframe")!.contentWindow as Window & {
      __vanillaInstanceId__?: string;
      __vanillaModuleCount__?: number;
    };
    const secondHost = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders-copy"]',
    )!;
    const secondFrame = secondHost.querySelector("iframe")!.contentWindow as Window & {
      __vanillaInstanceId__?: string;
      __vanillaModuleCount__?: number;
    };

    return {
      firstId: firstFrame.__vanillaInstanceId__,
      secondId: secondFrame.__vanillaInstanceId__,
      firstModuleCount: firstFrame.__vanillaModuleCount__,
      secondModuleCount: secondFrame.__vanillaModuleCount__,
      secondText: secondHost.shadowRoot!.querySelector("#vanilla-root")?.textContent,
      hostModuleCount: Reflect.get(window, "__vanillaModuleCount__"),
    };
  });

  expect(result.firstId).not.toBe(result.secondId);
  expect(result.firstModuleCount).toBe(1);
  expect(result.secondModuleCount).toBe(1);
  expect(result.secondText).toContain("Second orders application");
  expect(result.hostModuleCount).toBeUndefined();

  await page.evaluate(async () => {
    await window.__manualAppHandle__!.dispose();
    document.querySelector("#second-vanilla-slot")?.remove();
  });
  await expect(page.locator('micro-app-host[data-micro-app="vanilla-orders-copy"]')).toHaveCount(0);
});

test("persists application storage across Realm destruction and controller replacement", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.evaluate(async () => {
    await window.__microFrameRuntime__!.getAppHandle("vanilla-orders")!.dispose();
    window.__manualAppHandle__ = await window.__microFrameRuntime__!.mountApp({
      name: "vanilla-orders",
      entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
      container: "#vanilla-slot",
      props: { title: "Persistent orders application" },
    });
  });

  await expect(page.locator('micro-app-host[data-micro-app="vanilla-orders"]')).toHaveCount(1);
  const persistentBootstrapCount = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!.querySelector("iframe")!.contentWindow as Window & {
      __persistentBootstrapCount__?: number;
    };
    return frame.__persistentBootstrapCount__;
  });
  expect(persistentBootstrapCount).toBe(2);
});

test("installs the default same-origin resource namespace inside each Runtime Realm", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="vanilla-orders"]',
    )!;
    const frame = host.querySelector("iframe")!.contentWindow as Window & typeof globalThis;
    const logicalDatabaseName = `runtime-contract-${crypto.randomUUID()}`;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = frame.indexedDB.open(logicalDatabaseName, 1);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const physicalDatabaseName = database.name;
    database.close();
    const visibleDatabaseNames = typeof frame.indexedDB.databases === "function"
      ? (await frame.indexedDB.databases()).map((entry) => entry.name)
      : [];
    const channel = new frame.BroadcastChannel("contract-events");
    const channelName = channel.name;
    channel.close();
    const lockName = frame.navigator.locks
      ? await frame.navigator.locks.request("contract-lock", (lock) => lock?.name)
      : undefined;
    await new Promise<void>((resolve, reject) => {
      const request = frame.indexedDB.deleteDatabase(logicalDatabaseName);
      request.addEventListener("success", () => resolve(), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    return { channelName, lockName, logicalDatabaseName, physicalDatabaseName, visibleDatabaseNames };
  });

  expect(result.physicalDatabaseName).toBe(`micro-app:vanilla-orders:${result.logicalDatabaseName}`);
  if (result.visibleDatabaseNames.length > 0) {
    expect(result.visibleDatabaseNames).toContain(result.logicalDatabaseName);
    expect(result.visibleDatabaseNames).not.toContain(result.physicalDatabaseName);
  }
  expect(result.channelName).toBe("contract-events");
  if (result.lockName !== undefined) expect(result.lockName).toBe("contract-lock");
});

test("updates every adapter and explicitly remounts an application handle", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.evaluate(async () => {
    await Promise.all([
      window.__microFrameRuntime__!.getAppHandle("vanilla-orders")!.update({ title: "Updated Vanilla" }),
      window.__microFrameRuntime__!.getAppHandle("react-dashboard")!.update({ title: "Updated React" }),
      window.__microFrameRuntime__!.getAppHandle("vue-profile")!.update({ title: "Updated Vue" }),
      window.__microFrameRuntime__!.getAppHandle("vue2-console")!.update({ title: "Updated Vue 2" }),
    ]);
  });

  for (const [name, selector, text] of [
    ["vanilla-orders", "#vanilla-root", "Updated Vanilla"],
    ["react-dashboard", "#react-root", "Updated React"],
    ["vue-profile", "#vue-root", "Updated Vue"],
    ["vue2-console", "#vue2-root", "Updated Vue 2"],
  ] as const) {
    expect(await page.evaluate(({ name, selector }) => {
      const host = document.querySelector<HTMLElement>(`micro-app-host[data-micro-app="${name}"]`)!;
      return host.shadowRoot!.querySelector(selector)?.textContent;
    }, { name, selector })).toContain(text);
  }

  await page.evaluate(async () => {
    const handle = window.__microFrameRuntime__!.getAppHandle("vanilla-orders")!;
    await handle.unmount();
    await handle.mount();
  });
  await expect(page.locator('micro-app-host[data-micro-app="vanilla-orders"]')).toHaveCount(1);
  expect(await page.evaluate(() =>
    window.__microFrameRuntime__!.getAppStatus("vanilla-orders"),
  )).toBe("mounted");
});

test("leaves no manual Realm or surface after repeated create and destroy cycles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const slot = document.createElement("div");
    slot.id = "cleanup-stress-slot";
    document.body.append(slot);
    const instanceIds: string[] = [];

    for (let index = 0; index < 8; index++) {
      const handle = await window.__microFrameRuntime__!.mountApp({
        name: "cleanup-stress",
        entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
        container: slot,
        props: { title: `Cleanup cycle ${index}` },
      });
      const frame = slot.querySelector("iframe")!.contentWindow as Window & {
        __vanillaInstanceId__?: string;
      };
      instanceIds.push(frame.__vanillaInstanceId__ ?? "missing");
      await handle.dispose();
    }

    const remaining = {
      hosts: slot.querySelectorAll("micro-app-host").length,
      iframes: slot.querySelectorAll("iframe").length,
    };
    slot.remove();
    return { instanceIds, remaining };
  });

  expect(new Set(result.instanceIds).size).toBe(8);
  expect(result.remaining).toEqual({ hosts: 0, iframes: 0 });
});

test("keeps inactive Realms warm and evicts the least-recently-used cache entry", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const runtime = window.__microFrameRuntime__!;
    const containers = Array.from({ length: 4 }, (_, index) => {
      const container = document.createElement("div");
      container.dataset.keepAliveContainer = String(index + 1);
      document.body.append(container);
      return container;
    });
    const handles = [];
    const frames: HTMLIFrameElement[] = [];
    for (let index = 0; index < containers.length; index += 1) {
      const name = `keep-alive-${index + 1}`;
      const handle = await runtime.mountApp({
        name,
        entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
        container: containers[index]!,
        keepAlive: true,
        props: { title: `Keep alive ${index + 1}` },
      });
      handles.push(handle);
      frames.push(containers[index]!.querySelector("iframe")!);
      await handle.unmount();
    }

    const secondFrame = frames[1]!;
    const secondWindow = secondFrame.contentWindow as Window & {
      __vanillaModuleCount__?: number;
      __vanillaInstanceId__?: string;
    };
    const before = {
      frame: secondFrame,
      moduleCount: secondWindow.__vanillaModuleCount__,
      instanceId: secondWindow.__vanillaInstanceId__,
    };
    await handles[1]!.mount();
    const restoredFrame = containers[1]!.querySelector("iframe")!;
    const restoredWindow = restoredFrame.contentWindow as typeof secondWindow;
    const keptHost = containers[2]!.querySelector<HTMLElement>("micro-app-host")!;
    const snapshot = {
      firstStatus: handles[0]!.getStatus(),
      cachedStatuses: handles.slice(1).map((handle) => handle.getStatus()),
      firstRemoved: containers[0]!.querySelector("micro-app-host") === null,
      restoredSameFrame: restoredFrame === before.frame,
      restoredModuleCount: restoredWindow.__vanillaModuleCount__,
      restoredInstanceId: restoredWindow.__vanillaInstanceId__,
      beforeModuleCount: before.moduleCount,
      beforeInstanceId: before.instanceId,
      inactiveHidden: keptHost.hidden,
      inactiveInert: keptHost.inert,
      cacheCount: document.querySelectorAll('micro-app-host[data-micro-app^="keep-alive-"]').length,
    };

    await Promise.all(handles.map((handle) => handle.dispose()));
    for (const container of containers) container.remove();
    return snapshot;
  });

  expect(result).toEqual({
    firstStatus: "disposed",
    cachedStatuses: ["mounted", "unmounted", "unmounted"],
    firstRemoved: true,
    restoredSameFrame: true,
    restoredModuleCount: 1,
    restoredInstanceId: result.beforeInstanceId,
    beforeModuleCount: 1,
    beforeInstanceId: expect.stringMatching(/^keep-alive-2:/),
    inactiveHidden: true,
    inactiveInert: true,
    cacheCount: 3,
  });
});

test("prewarms inactive Realms off the critical path and reuses the pooled instance", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const runtime = window.__microFrameRuntime__!;
    const names = ["prewarm-1", "prewarm-2", "prewarm-3"];
    const containers = names.map((name) => {
      const container = document.createElement("div");
      container.dataset.prewarmContainer = name;
      document.body.append(container);
      return container;
    });
    runtime.registerApps(names.map((name, index) => ({
      name,
      entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
      container: containers[index]!,
      activeWhen: "/route-that-is-not-active",
      props: { title: `Prewarm ${index + 1}` },
    })));

    await runtime.prewarmApps(names);
    const secondFrame = containers[1]!.querySelector("iframe")!;
    const secondWindow = secondFrame.contentWindow as Window & {
      __vanillaModuleCount__?: number;
      __vanillaInstanceId__?: string;
    };
    const before = {
      moduleCount: secondWindow.__vanillaModuleCount__,
      instanceId: secondWindow.__vanillaInstanceId__,
    };
    await runtime.getAppHandle("prewarm-2")!.mount();
    const restoredFrame = containers[1]!.querySelector("iframe")!;
    const restoredWindow = restoredFrame.contentWindow as typeof secondWindow;
    const snapshot = {
      statuses: names.map((name) => runtime.getAppStatus(name)),
      firstRemoved: containers[0]!.querySelector("micro-app-host") === null,
      pooledCount: document.querySelectorAll('micro-app-host[data-micro-app^="prewarm-"]').length,
      pooledHidden: containers[2]!.querySelector<HTMLElement>("micro-app-host")!.hidden,
      pooledInert: containers[2]!.querySelector<HTMLElement>("micro-app-host")!.inert,
      reusedFrame: restoredFrame === secondFrame,
      beforeModuleCount: before.moduleCount,
      restoredModuleCount: restoredWindow.__vanillaModuleCount__,
      beforeInstanceId: before.instanceId,
      restoredInstanceId: restoredWindow.__vanillaInstanceId__,
    };

    await Promise.all(names.slice(1).map((name) => runtime.getAppHandle(name)!.dispose()));
    for (const container of containers) container.remove();
    return snapshot;
  });

  expect(result).toEqual({
    statuses: ["disposed", "mounted", "bootstrapped"],
    firstRemoved: true,
    pooledCount: 2,
    pooledHidden: true,
    pooledInert: true,
    reusedFrame: true,
    beforeModuleCount: 1,
    restoredModuleCount: 1,
    beforeInstanceId: expect.stringMatching(/^prewarm-2:/),
    restoredInstanceId: result.beforeInstanceId,
  });
});

test("prewarms a manual application and mounts through the returned handle", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const slot = document.createElement("div");
    slot.id = "manual-prewarm-slot";
    document.body.append(slot);
    const handle = await window.__microFrameRuntime__!.prewarmApp({
      name: "manual-prewarm-contract",
      entry: { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
      container: slot,
      props: { title: "Manual prewarm" },
    });
    window.__manualAppHandle__ = handle;
    const host = slot.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="manual-prewarm-contract"]',
    )!;
    const frame = host.querySelector("iframe")!.contentWindow as Window & {
      __vanillaInstanceId__?: string;
      __vanillaModuleCount__?: number;
    };
    const before = {
      status: handle.getStatus(),
      hidden: host.hidden,
      inert: host.inert,
      instanceId: frame.__vanillaInstanceId__,
      moduleCount: frame.__vanillaModuleCount__,
      iframe: host.querySelector("iframe"),
    };
    await handle.mount();
    return {
      before: { ...before, iframe: undefined },
      status: handle.getStatus(),
      hidden: host.hidden,
      inert: host.inert,
      sameIframe: before.iframe === host.querySelector("iframe"),
      instanceId: frame.__vanillaInstanceId__,
      moduleCount: frame.__vanillaModuleCount__,
      text: host.shadowRoot?.querySelector("#vanilla-root")?.textContent,
    };
  });

  expect(result.before).toMatchObject({
    status: "bootstrapped",
    hidden: true,
    inert: true,
    moduleCount: 1,
  });
  expect(result.status).toBe("mounted");
  expect(result.hidden).toBe(false);
  expect(result.inert).toBe(false);
  expect(result.sameIframe).toBe(true);
  expect(result.instanceId).toBe(result.before.instanceId);
  expect(result.moduleCount).toBe(1);
  expect(result.text).toContain("Manual prewarm");

  await page.evaluate(async () => {
    await window.__manualAppHandle__!.dispose();
    document.querySelector("#manual-prewarm-slot")?.remove();
  });
});

test("rolls back to an ordered fallback Entry and cleans the failed Realm", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  const result = await page.evaluate(async () => {
    const runtime = window.__microFrameRuntime__!;
    const phases: string[] = [];
    const off = runtime.errors.subscribe((event) => phases.push(event.phase));
    const container = document.createElement("div");
    document.body.append(container);
    const handle = await runtime.mountApp({
      name: "fallback-contract",
      entry: { url: "http://127.0.0.1:5174/missing-primary-entry.js", type: "module" },
      fallbackEntries: [
        { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
      ],
      container,
      props: { title: "Fallback contract" },
    });
    const hosts = container.querySelectorAll("micro-app-host");
    const frame = hosts[0]!.querySelector("iframe")!;
    const frameWindow = frame.contentWindow as Window & {
      __vanillaModuleCount__?: number;
      __vanillaInstanceId__?: string;
    };
    const snapshot = {
      status: handle.getStatus(),
      hostCount: hosts.length,
      iframeCount: container.querySelectorAll("iframe").length,
      moduleCount: frameWindow.__vanillaModuleCount__,
      instanceId: frameWindow.__vanillaInstanceId__,
      phases,
    };
    off();
    await handle.dispose();
    snapshot.hostCount = container.querySelectorAll("micro-app-host").length;
    container.remove();
    return snapshot;
  });

  expect(result).toMatchObject({
    status: "mounted",
    hostCount: 0,
    iframeCount: 1,
    moduleCount: 1,
    instanceId: expect.stringMatching(/^fallback-contract:/),
    phases: ["load-fallback"],
  });
});

test("cancels a stale mount during a rapid route change", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.evaluate(() => {
    const slot = document.createElement("div");
    slot.id = "slow-route-slot";
    document.body.append(slot);
    window.__microFrameRuntime__!.registerApps([{
      name: "slow-route",
      entry: { url: "http://127.0.0.1:5174/src/slow-lifecycle.ts", type: "module" },
      container: slot,
      activeWhen: "/slow",
    }]);
    history.pushState({}, "", "/slow");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await page.waitForFunction(() => {
    const iframe = document.querySelector<HTMLElement>(
      'micro-app-host[data-micro-app="slow-route"]',
    )?.querySelector("iframe");
    return Boolean((iframe?.contentWindow as Window & { __slowMountStarted__?: boolean } | null)?.__slowMountStarted__);
  });

  await page.evaluate(() => {
    history.pushState({}, "", "/after-slow");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.locator('micro-app-host[data-micro-app="slow-route"]')).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => ({
    status: window.__microFrameRuntime__!.getAppStatus("slow-route"),
    staleRoot: Boolean(document.querySelector("#slow-route-root")),
  }))).toEqual({ status: "unmounted", staleRoot: false });
});

test("destroys the iframe Realm and Shadow surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");

  await page.evaluate(async () => {
    await window.__microFrameRuntime__!.destroy();
  });

  await expect(page.locator("micro-app-host")).toHaveCount(0);
});

declare global {
  interface Window {
    __manualAppHandle__?: { dispose(): Promise<void> };
  }
}

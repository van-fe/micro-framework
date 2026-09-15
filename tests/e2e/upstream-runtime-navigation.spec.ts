import { isolateBrowserProcess } from "./browser-process-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { addSlot, counterEntry, expect, test } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

const cssPath = new URL("../../examples/vanilla-app/src/upstream-runtime-hmr.css", import.meta.url);

test("W12 applies a real Vite WebSocket CSS HMR update to root variables without replacing the Realm", async ({ page }) => {
  const originalCss = await readFile(cssPath, "utf8");
  expect(originalCss).toContain("rgb(27, 84, 147)");
  const updates: string[] = [];
  page.on("websocket", (socket) => {
    if (!socket.url().includes(":5174")) return;
    socket.on("framereceived", ({ payload }) => updates.push(String(payload)));
  });
  await addSlot(page, "hmr-slot");
  await addSlot(page, "hmr-sibling-slot");
  await page.route("**/upstream-runtime-hmr-sibling.js", (route) => route.fulfill({
    contentType: "text/javascript", body: counterEntry + `
      export function bootstrap() {
        const style = document.createElement('style');
        style.textContent = ':root { --upstream-hmr-color: rgb(31, 98, 52); } button { color: var(--upstream-hmr-color); }';
        document.head.appendChild(style);
      }
    `,
  }));
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    document.documentElement.style.setProperty("--upstream-hmr-color", "rgb(98, 21, 77)");
    state.handles.push(await state.runtime.mountApp({
      name: "vite-hmr", container: state.slots[0]!,
      entry: { type: "module", url: "http://127.0.0.1:5174/src/upstream-runtime-hmr.ts" },
    }));
    state.handles.push(await state.runtime.mountApp({
      name: "vite-hmr-sibling", container: state.slots[1]!,
      entry: { type: "module", url: new URL("/upstream-runtime-hmr-sibling.js", location.href).href },
      props: { title: "Sibling" },
    }));
    state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    state.originalHost = state.slots[0]!.querySelector("micro-app-host")!;
  });
  const button = page.locator("#hmr-slot").getByRole("button");
  const sibling = page.locator("#hmr-sibling-slot").getByRole("button");
  await expect(button).toHaveCSS("color", "rgb(27, 84, 147)");
  await expect(button).toHaveCSS("padding-left", "11px");
  await expect(sibling).toHaveCSS("color", "rgb(31, 98, 52)");
  await button.click();
  await expect(button).toHaveText("Live HMR: 1");
  try {
    await writeFile(cssPath, originalCss.replace("rgb(27, 84, 147)", "rgb(151, 48, 91)").replace("11px", "23px"));
    await expect.poll(() => updates.some((raw) => {
      try {
        const message = JSON.parse(raw) as { type?: string; updates?: Array<{ path?: string; acceptedPath?: string }> };
        return message.type === "update" && message.updates?.some((update) =>
          update.path?.includes("upstream-runtime-hmr.css") || update.acceptedPath?.includes("upstream-runtime-hmr.css"));
      } catch { return false; }
    })).toBe(true);
    await expect(button).toHaveCSS("color", "rgb(151, 48, 91)");
    await expect(button).toHaveCSS("padding-left", "23px");
    await expect(button).toHaveText("Live HMR: 1");
    await button.click();
    await expect(button).toHaveText("Live HMR: 2");
    await expect(sibling).toHaveCSS("color", "rgb(31, 98, 52)");
    expect(await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      const host = state.slots[0]!.querySelector("micro-app-host")!;
      const frame = host.querySelector("iframe")!;
      return {
        hostToken: getComputedStyle(document.documentElement).getPropertyValue("--upstream-hmr-color").trim(),
        appToken: getComputedStyle(host).getPropertyValue("--upstream-hmr-color").trim(),
        sameFrame: frame === state.originalFrame, sameHost: host === state.originalHost,
        realmOwnsButton: frame.contentDocument!.querySelector("[data-upstream-hmr-token]") === host.shadowRoot!.querySelector("button"),
        statuses: state.handles.map((handle) => handle.getStatus()),
      };
    })).toEqual({ hostToken: "rgb(98, 21, 77)", appToken: "rgb(151, 48, 91)", sameFrame: true, sameHost: true,
      realmOwnsButton: true, statuses: ["mounted", "mounted"] });
  } finally {
    await writeFile(cssPath, originalCss);
    await expect(button).toHaveCSS("color", "rgb(27, 84, 147)");
    await page.evaluate(() => document.documentElement.style.removeProperty("--upstream-hmr-color"));
  }
});

test("W107 keeps empty and fragment anchor clicks inside the application without navigating the host", async ({ page }) => {
  const documentNavigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) documentNavigations.push(frame.url());
  });
  await page.route("**/upstream-runtime-anchors.html", (route) => route.fulfill({
    contentType: "text/html", headers: { "Access-Control-Allow-Origin": "*" },
    body: `<nav><a href="">Empty application link</a> <a href="#app-section">Application fragment</a>
      <a href="#cancelled" data-cancel-anchor>Cancelled application fragment</a></nav>
      <p id="app-section">Application anchor target</p>
      <script type="module" src="/upstream-runtime-anchor-entry.js"></script>`,
  }));
  await page.route("**/upstream-runtime-anchor-entry.js", (route) => route.fulfill({
    contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" }, body: counterEntry + `
      export function bootstrap() {
        let changes = 0;
        window.addEventListener('hashchange', () => {
          document.body.dataset.anchorHash = location.hash;
          document.body.dataset.anchorChanges = String(++changes);
        });
        document.addEventListener('click', (event) => {
          if (event.target.closest('[data-cancel-anchor]')) {
            event.preventDefault();
            document.body.dataset.anchorCancelled = 'true';
          }
        });
      }
    `,
  }));
  await addSlot(page, "anchor-slot");
  const realmDocumentUrl = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    history.replaceState(history.state, "", "#host-stable");
    state.handles.push(await state.runtime.mountApp({
      name: "anchor-navigation", container: state.slots[0]!,
      entry: { type: "html", url: "http://127.0.0.1:5174/upstream-runtime-anchors.html" },
      props: { title: "Anchor app" },
    }));
    state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    state.originalHost = state.slots[0]!.querySelector("micro-app-host")!;
    return state.originalFrame.contentWindow!.location.href;
  });
  const hostUrl = page.url();
  documentNavigations.length = 0;
  const button = page.locator("#anchor-slot").getByRole("button");
  await button.click();
  await expect(button).toHaveText("Anchor app: 1");
  await page.locator("#anchor-slot").getByRole("link", { name: "Application fragment", exact: true }).click();
  await expect(page).toHaveURL(hostUrl);
  await expect.poll(() => page.evaluate(() =>
    window.__upstreamRuntime__!.originalFrame!.contentWindow!.location.hash)).toBe("#app-section");
  const fragmentUrl = new URL("#app-section", realmDocumentUrl).href;
  expect(await page.evaluate(() =>
    window.__upstreamRuntime__!.originalFrame!.contentWindow!.location.href)).toBe(fragmentUrl);
  const appBody = page.locator("#anchor-slot [data-micro-app-root]");
  await expect(appBody).toHaveAttribute("data-anchor-changes", "1");
  await expect(appBody).toHaveAttribute("data-anchor-hash", "#app-section");
  await expect(page.locator("#anchor-slot #app-section")).toBeVisible();
  await page.locator("#anchor-slot").getByRole("link", { name: "Cancelled application fragment", exact: true }).click();
  await expect(appBody).toHaveAttribute("data-anchor-cancelled", "true");
  await expect(appBody).toHaveAttribute("data-anchor-changes", "1");
  expect(await page.evaluate(() => window.__upstreamRuntime__!.originalFrame!.contentWindow!.location.hash)).toBe("#app-section");
  expect(await page.evaluate(() =>
    window.__upstreamRuntime__!.originalFrame!.contentWindow!.location.href)).toBe(fragmentUrl);
  await page.locator("#anchor-slot").getByRole("link", { name: "Empty application link" }).click();
  await expect(page).toHaveURL(hostUrl);
  await expect.poll(() => page.evaluate(() =>
    window.__upstreamRuntime__!.originalFrame!.contentWindow!.location.hash)).toBe("");
  await expect(appBody).toHaveAttribute("data-anchor-changes", "2");
  await expect(button).toHaveText("Anchor app: 1");
  await button.click();
  await expect(button).toHaveText("Anchor app: 2");
  expect(await page.evaluate(() => {
    const state = window.__upstreamRuntime__!;
    const documentUrl = new URL(state.originalFrame!.contentWindow!.location.href);
    documentUrl.hash = "";
    return {
      status: state.handles[0]!.getStatus(),
      sameFrame: state.originalFrame === state.slots[0]!.querySelector("iframe"),
      sameHost: state.originalHost === state.slots[0]!.querySelector("micro-app-host"),
      frameDocumentUrl: documentUrl.href,
      emptyHref: state.originalHost!.shadowRoot!.querySelector("a")!.getAttribute("href"),
    };
  })).toEqual({ status: "mounted", sameFrame: true, sameHost: true, frameDocumentUrl: realmDocumentUrl, emptyHref: "" });
  expect(documentNavigations).toEqual([]);
});

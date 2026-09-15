import { MicroRuntime } from "@micro-framework/runtime-core";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

interface ComponentContract {
  readonly name: string;
  readonly entry: string;
  readonly realmMarker: string;
  readonly tooltipTrigger: string;
  readonly tooltipMarker: string;
  readonly tooltipRoot: string;
  readonly menuTrigger: string;
  readonly menuMarker: string;
  readonly menuRoot: string;
  readonly feedback: string;
  readonly feedbackText: string;
}

const contracts: readonly ComponentContract[] = [
  {
    name: "react-dashboard",
    entry: "http://127.0.0.1:5275/src/lifecycle.tsx",
    realmMarker: "__reactRealm__",
    tooltipTrigger: '[data-open-popup="react-tooltip"]',
    tooltipMarker: '[data-overlay-kind="react-tooltip"]',
    tooltipRoot: ".ant-tooltip",
    menuTrigger: '[data-open-popup="react-menu"]',
    menuMarker: '[data-overlay-kind="react-menu-item"]',
    menuRoot: ".ant-dropdown",
    feedback: "[data-react-popup-feedback]",
    feedbackText: "预测偏差说明已准备",
  },
  {
    name: "vue-profile",
    entry: "http://127.0.0.1:5276/src/lifecycle.ts",
    realmMarker: "__vueRealm__",
    tooltipTrigger: '[data-open-popup="vue3-tooltip"]',
    tooltipMarker: ".vue-contract-tooltip",
    tooltipRoot: ".el-popper",
    menuTrigger: '[data-open-popup="vue3-menu"]',
    menuMarker: '[data-overlay-kind="vue3-menu-item"]',
    menuRoot: ".el-popper",
    feedback: ".action-feedback",
    feedbackText: "客户备注已准备",
  },
  {
    name: "vue2-console",
    entry: "http://127.0.0.1:5279/src/lifecycle.ts",
    realmMarker: "__vue2Realm__",
    tooltipTrigger: '[data-open-popup="vue2-tooltip"]',
    tooltipMarker: ".vue2-contract-tooltip",
    tooltipRoot: ".el-tooltip__popper",
    menuTrigger: '[data-open-popup="vue2-menu"]',
    menuMarker: '[data-overlay-kind="vue2-menu-item"]',
    menuRoot: ".el-dropdown-menu",
    feedback: "[data-vue2-popup-feedback]",
    feedbackText: "迁移依赖检查已完成",
  },
] as const;

const runtimes = new Set<MicroRuntime>();
const fixtures = new Set<HTMLElement>();

function visible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none"
    && style.visibility !== "hidden"
    && Number.parseFloat(style.opacity || "1") > 0
    && rect.width > 0
    && rect.height > 0;
}

async function findInteractableElement(host: HTMLElement, selector: string): Promise<HTMLElement> {
  await expect.poll(() => host.shadowRoot?.querySelector(selector) instanceof HTMLElement).toBe(true);
  const element = host.shadowRoot!.querySelector<HTMLElement>(selector)!;
  element.scrollIntoView({ block: "center", inline: "center" });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  return element;
}

async function movePointerInto(element: HTMLElement, resetPointer = true): Promise<void> {
  const rect = element.getBoundingClientRect();
  const parkingTarget = document.querySelector<HTMLButtonElement>("[data-safari-pointer-park]");
  if (!parkingTarget) throw new Error("Missing Safari pointer parking target.");
  const horizontalOffset = Math.max(1, Math.floor((rect.width - 2) / 4));
  const first = {
    xOffset: -horizontalOffset,
    yOffset: 0,
  };
  const second = {
    xOffset: horizontalOffset,
    yOffset: 0,
  };
  if (resetPointer) await userEvent.click(parkingTarget);
  await userEvent.hover(element, first);
  await userEvent.hover(element, second);
}

async function clickElement(element: HTMLElement, resetPointer = true): Promise<void> {
  await movePointerInto(element, resetPointer);
  await userEvent.click(element);
}

function popupContract(
  host: HTMLElement,
  triggerSelector: string,
  markerSelector: string,
  rootSelector: string,
): Record<string, boolean> {
  const shadowRoot = host.shadowRoot!;
  const trigger = shadowRoot.querySelector<HTMLElement>(triggerSelector)!;
  const marker = shadowRoot.querySelector<HTMLElement>(markerSelector)!;
  const popup = marker.matches(rootSelector)
    ? marker
    : marker.closest<HTMLElement>(rootSelector)!;
  const triggerRect = trigger.getBoundingClientRect();
  const rect = popup.getBoundingClientRect();
  const horizontalGap = Math.max(triggerRect.left - rect.right, rect.left - triggerRect.right, 0);
  const verticalGap = Math.max(triggerRect.top - rect.bottom, rect.top - triggerRect.bottom, 0);
  return {
    anchored: Math.hypot(horizontalGap, verticalGap) <= 160,
    insideApplicationShadow: popup.getRootNode() === shadowRoot,
    leakedToHostTree: document.querySelector(markerSelector) !== null,
    ownedByHostDocument: popup.ownerDocument === document,
    promotedAsModal: popup.hasAttribute("data-micro-global-overlay-root"),
    visibleInViewport: rect.right > 0
      && rect.bottom > 0
      && rect.left < innerWidth
      && rect.top < innerHeight,
  };
}

async function verifyComponentLibrary(contract: ComponentContract): Promise<void> {
  const pointerParkingTarget = document.createElement("button");
  pointerParkingTarget.type = "button";
  pointerParkingTarget.ariaLabel = "Reset Safari pointer";
  pointerParkingTarget.dataset.safariPointerPark = "";
  pointerParkingTarget.style.cssText = [
    "position:fixed",
    "left:16px",
    "top:16px",
    "display:block",
    "width:48px",
    "height:48px",
    "z-index:2147483647",
    "opacity:0.01",
    "pointer-events:auto",
  ].join(";");
  document.body.append(pointerParkingTarget);
  fixtures.add(pointerParkingTarget);
  const fixture = document.createElement("section");
  fixture.style.cssText = "display:block;width:min(960px,100%);min-height:480px;margin:8px auto";
  document.body.append(fixture);
  fixtures.add(fixture);
  const runtimeErrors: string[] = [];
  const runtime = new MicroRuntime({
    bootstrapUrl: new URL("/realm-bootstrap.js", location.origin).href,
  });
  runtime.errors.subscribe(({ phase, error }) => {
    runtimeErrors.push(`${phase}:${error instanceof Error ? error.message : String(error)}`);
  });
  runtimes.add(runtime);
  const handle = await runtime.mountApp({
    name: contract.name,
    entry: { url: contract.entry, type: "module" },
    container: fixture,
    props: {
      title: contract.name,
      locale: "zh-CN",
      market: "North America",
      period: "live",
    },
  });
  expect(handle.getStatus()).toBe("mounted");

  const host = fixture.querySelector<HTMLElement>(`micro-app-host[data-micro-app="${contract.name}"]`)!;
  const frameWindow = host.querySelector("iframe")!.contentWindow as Window & Record<string, unknown>;
  expect(frameWindow[contract.realmMarker]).toBeTruthy();

  const tooltipTrigger = await findInteractableElement(host, contract.tooltipTrigger);
  await movePointerInto(tooltipTrigger);
  await expect.poll(() => visible(host.shadowRoot!.querySelector(contract.tooltipMarker))).toBe(true);
  await expect.poll(() => popupContract(
    host,
    contract.tooltipTrigger,
    contract.tooltipMarker,
    contract.tooltipRoot,
  )).toEqual({
    anchored: true,
    insideApplicationShadow: true,
    leakedToHostTree: false,
    ownedByHostDocument: true,
    promotedAsModal: false,
    visibleInViewport: true,
  });
  await userEvent.hover(pointerParkingTarget);
  await expect.poll(() => visible(host.shadowRoot!.querySelector(contract.tooltipMarker))).toBe(false);

  const menuTrigger = await findInteractableElement(host, contract.menuTrigger);
  await clickElement(menuTrigger);
  await expect.poll(() => visible(host.shadowRoot!.querySelector(contract.menuMarker))).toBe(true);
  await expect.poll(() => popupContract(
    host,
    contract.menuTrigger,
    contract.menuMarker,
    contract.menuRoot,
  )).toEqual({
    anchored: true,
    insideApplicationShadow: true,
    leakedToHostTree: false,
    ownedByHostDocument: true,
    promotedAsModal: false,
    visibleInViewport: true,
  });
  const menuMarker = host.shadowRoot!.querySelector<HTMLElement>(contract.menuMarker)!;
  const menuAction = menuMarker.closest<HTMLElement>('[role="menuitem"],li') ?? menuMarker;
  menuAction.scrollIntoView({ block: "center", inline: "center" });
  // An outside parking click would dismiss the very menu we are about to test.
  await clickElement(menuAction, false);
  await expect.poll(() => host.shadowRoot!.querySelector(contract.feedback)?.textContent ?? "")
    .toContain(contract.feedbackText);

  await clickElement(menuTrigger);
  await expect.poll(() => visible(host.shadowRoot!.querySelector(contract.menuMarker))).toBe(true);
  await runtime.destroy();
  runtimes.delete(runtime);
  expect(fixture.querySelector("micro-app-host")).toBeNull();
  expect(runtimeErrors).toEqual([]);
}

afterEach(async () => {
  await Promise.all([...runtimes].map((runtime) => runtime.destroy()));
  runtimes.clear();
  for (const fixture of fixtures) fixture.remove();
  fixtures.clear();
});

describe("real Safari component-library applications", () => {
  for (const contract of contracts) {
    it(`runs ${contract.name} Tooltip and Menu in its iframe Realm and ShadowRoot`, async () => {
      await verifyComponentLibrary(contract);
    });
  }
});

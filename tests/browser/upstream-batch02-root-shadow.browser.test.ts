import { afterEach, expect, it } from "vitest";
import { domApplication, domCleanups } from "./upstream-batch02-dom-fixture";

afterEach(() => {for (const cleanup of domCleanups.splice(0).reverse()) cleanup();});

it("Q2137 keeps root-level children visible and nested native ShadowRoot styles scoped while scripts stay in the iframe", async () => {
  const fonts=[...document.fonts];
  const app=await domApplication();
  const frameElement=app.frame.frameElement as HTMLIFrameElement;
  const result=app.probe.rootShadow!();
  expect(result.host.parentNode).toBe(app.surface.shadowRoot);
  expect(app.surface.body.contains(result.host)).toBe(false);
  expect(app.frame.document.querySelector("#owned-root-child")).toBe(result.host);
  expect(app.frame.document.querySelector(".owned-button")).toBeNull();
  expect(getComputedStyle(result.host).fontSize,JSON.stringify({appFont:getComputedStyle(app.surface.host).fontSize,nestedCSS:[...result.style.sheet.cssRules].map((rule:CSSRule)=>rule.cssText)})).toBe("40px");
  expect(getComputedStyle(result.button).width).toBe("40px");
  expect(getComputedStyle(result.button).color).toBe("rgb(17, 34, 51)");
  expect(result.button.getBoundingClientRect().height).toBeGreaterThan(0);
  expect((await app.frame.document.fonts.load('20px "OwnedNestedFont"',"\ue6cf")).length).toBe(1);
  expect(result.scriptResult.document).toBe(app.frame.document);
  expect(result.script.parentNode).toBe(app.bridge.nativeHead);
  expect(Reflect.has(window,"__ownedNestedScript")).toBe(false);
  expect(frameElement.parentNode).toBe(app.surface.host);
  expect(frameElement.hidden).toBe(true);
  expect(frameElement.getBoundingClientRect().height).toBe(0);
  app.destroy();
  expect(Object.hasOwn(result.host,"attachShadow")).toBe(false);
  expect(Object.hasOwn(result.root,"appendChild")).toBe(false);
  expect(result.style.textContent).toBe("");
  expect([...document.fonts]).toEqual(fonts);
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { domApplication, domCleanups } from "./upstream-batch02-dom-fixture";

afterEach(() => { for (const cleanup of domCleanups.splice(0).reverse()) cleanup(); });

describe("batch02 nested application browser contracts", () => {
  it("W1106 routes window drag listeners to their application with once, abort and destroy cleanup", async () => {
    const owner = await domApplication();
    const sibling = await domApplication();
    const one = owner.probe.inputListeners!();
    const two = sibling.probe.inputListeners!();
    owner.surface.body.dispatchEvent(new MouseEvent("mousedown", {bubbles:true,composed:true}));
    document.body.dispatchEvent(new MouseEvent("mousemove", {bubbles:true,composed:true}));
    expect(one.calls.map((call: {type:string}) => call.type)).toEqual(["mousemove", "once"]);
    expect(two.calls).toEqual([]);
    document.body.dispatchEvent(new MouseEvent("mouseup", {bubbles:true,composed:true}));
    await Promise.resolve();
    owner.bridge.destroy();
    owner.surface.body.dispatchEvent(new MouseEvent("mousemove", {bubbles:true,composed:true}));
    expect(one.calls.map((call: {type:string}) => call.type)).toEqual(["mousemove", "once", "mouseup"]);
    sibling.surface.body.dispatchEvent(new MouseEvent("mousemove", {bubbles:true,composed:true}));
    expect(two.calls.map((call: {type:string}) => call.type)).toEqual(["mousemove", "once"]);
  });

  it("W845 W1059 loads a font from the third insertAdjacentElement style in nested shadows with application family isolation", async () => {
    const normalURL = new URL("/upstream-batch02-font-normal.ttf", location.href).href;
    const wideURL = new URL("/upstream-batch02-font-wide.ttf", location.href).href;
    const hostFont = new FontFace("Batch02HostControl", `url("${normalURL}")`);
    document.fonts.add(hostFont); await hostFont.load();
    const control = document.createElement("span");
    control.style.cssText = 'font:20px "Batch02HostControl";display:inline-block'; control.textContent = "\ue6cf";
    document.body.append(control);
    const collision = document.createElement("span");
    collision.style.cssText = 'font:20px "Batch02Icons";display:inline-block'; collision.textContent = "\ue6cf";
    document.body.append(collision);
    const hostCollisionWidth = collision.getBoundingClientRect().width;
    domCleanups.push(() => {control.remove(); collision.remove(); document.fonts.delete(hostFont);});
    const normalWidth = control.getBoundingClientRect().width;
    const hostFamily = getComputedStyle(control).fontFamily;
    const initialFonts = [...document.fonts];
    const outer = await domApplication();
    const nested = await domApplication(outer.surface.body, new URL("/font-app/assets/index.html", location.href).href);
    const sibling = await domApplication();
    const nestedResult = nested.probe.fontStyles!("../../upstream-batch02-font-normal.ttf");
    const siblingResult = sibling.probe.fontStyles!(wideURL);
    await vi.waitFor(async () => {
      const loaded = await nestedResult.loaded();
      expect(loaded.length, JSON.stringify({
        ownLoad: Object.hasOwn(nested.frame.document.fonts,"load"),
        aliases: [...nested.surface.styles.fonts.families],
        faces: nested.surface.styles.fonts.entries().map(face => ({family:face.family,status:face.status})),
        host: [...document.fonts].map(face => ({family:face.family,status:face.status})),
        css: nestedResult.styles[2].sheet?.cssRules[0]?.cssText,
      })).toBe(1);
      expect((await siblingResult.loaded()).length).toBe(1);
      expect(nestedResult.node.getBoundingClientRect().width).toBeCloseTo(normalWidth, 1);
      expect(siblingResult.node.getBoundingClientRect().width).toBeCloseTo(normalWidth * 2, 1);
    });
    expect([...nested.surface.head.querySelectorAll("style")]).toEqual(nestedResult.styles);
    expect(getComputedStyle(control).fontFamily).toBe(hostFamily);
    expect(collision.getBoundingClientRect().width).toBe(hostCollisionWidth);
    nested.destroy(); sibling.destroy(); outer.destroy();
    await vi.waitFor(() => expect([...document.fonts]).toEqual(initialFonts));
  });

  it("W845 normalizes a native external stylesheet before activating its font family", async () => {
    const host = document.createElement("span"); host.textContent = "\ue6cf";
    host.style.cssText = 'font:20px "Batch02ExternalIcons";display:inline-block'; document.body.append(host);
    const hostWidth = host.getBoundingClientRect().width;
    const initialFonts = [...document.fonts];
    domCleanups.push(() => host.remove());
    const app = await domApplication();
    const result = app.probe.externalFont!("/upstream-batch02-external-font.css");
    await vi.waitFor(async () => {
      expect((await result.loaded()).length).toBe(1);
      expect(result.node.getBoundingClientRect().width).toBe(20);
    });
    expect(host.getBoundingClientRect().width).toBe(hostWidth);
    expect(result.link.media).toBe("");
    expect(result.link.getAttribute("media")).toBeNull();
    expect(result.link.hasAttribute("media")).toBe(false);
    result.link.media="screen";
    expect(result.link.getAttribute("media")).toBe("screen");
    expect(result.link.hasAttribute("media")).toBe(true);
    result.link.removeAttribute("media");
    expect(result.link.getAttribute("media")).toBeNull();
    expect(result.link.hasAttribute("media")).toBe(false);
    expect((await result.loaded()).length).toBe(1);
    expect(result.node.getBoundingClientRect().width).toBe(20);
    expect(host.getBoundingClientRect().width).toBe(hostWidth);
    app.destroy();
    await vi.waitFor(() => expect([...document.fonts]).toEqual(initialFonts));
  });

  it("W845 resolves font variables introduced by later CSSOM rules and inline declarations", async () => {
    const app = await domApplication();
    const style = app.frame.document.createElement("style");
    style.textContent = '@font-face{font-family:LateSheetFont;src:url("/upstream-batch02-font-normal.ttf")} @font-face{font-family:LateInlineFont;src:url("/upstream-batch02-font-wide.ttf")} :root{--late-sheet:LateSheetFont;--late-inline:LateInlineFont}';
    app.frame.document.head.appendChild(style);
    await app.frame.document.fonts.load('20px "LateSheetFont"',"\ue6cf");
    await app.frame.document.fonts.load('20px "LateInlineFont"',"\ue6cf");
    const cssNode = app.frame.document.createElement("span");cssNode.className="late-sheet-font";
    cssNode.textContent="\ue6cf";cssNode.style.cssText="font-size:20px;display:inline-block";
    app.frame.document.body.append(cssNode);
    style.sheet!.insertRule('.late-sheet-font{font-family:var(--late-sheet)}',style.sheet!.cssRules.length);
    expect(cssNode.getBoundingClientRect().width,JSON.stringify({
      family:getComputedStyle(cssNode).fontFamily,variable:getComputedStyle(app.surface.host).getPropertyValue("--late-sheet"),
      css:[...style.sheet!.cssRules].map(rule=>rule.cssText),
      faces:app.surface.styles.fonts.entries().map(face=>({family:face.family,status:face.status})),
      tokens:app.surface.shadowRoot.querySelector("[data-micro-document-tokens]")?.textContent,
    })).toBe(20);
    const inlineNode = app.frame.document.createElement("span");inlineNode.textContent="\ue6cf";
    inlineNode.style.cssText="font-size:20px;font-family:var(--late-inline);display:inline-block";
    app.frame.document.body.append(inlineNode);
    await vi.waitFor(() => expect(inlineNode.getBoundingClientRect().width).toBe(40));
  });

  it("W421 preserves fill-available height through an application document root and flex parent", async () => {
    const app = await domApplication();
    app.container.style.height = "300px";
    const {parent,child} = app.probe.fillAvailable!();
    await vi.waitFor(() => {
      expect(parent.getBoundingClientRect().height).toBe(280);
      if (CSS.supports("height", "stretch") || CSS.supports("height", "-webkit-fill-available")) {
        expect(child.getBoundingClientRect().height).toBe(280);
      }
    });
  });

  it("W790 delivers native nested iframe replies only to its owning application and stops bridging on destroy", async () => {
    const owner = await domApplication();
    const sibling = await domApplication();
    const one = owner.probe.iframeMessages!("/upstream-batch02-child-frame.html");
    const two = sibling.probe.iframeMessages!("/upstream-batch02-child-frame.html");
    await Promise.all([one,two].map(result => new Promise<void>(resolve => result.frame.onload = () => resolve())));
    one.frame.contentWindow.postMessage({batch02:"request",token:1}, location.origin);
    await vi.waitFor(() => expect(one.events).toEqual([{data:{batch02:"reply",token:1},origin:location.origin,correctSource:true}]));
    expect(two.events).toEqual([]);
    owner.bridge.destroy();
    one.frame.contentWindow.postMessage({batch02:"request",token:2}, location.origin);
    two.frame.contentWindow.postMessage({batch02:"request",token:3}, location.origin);
    await vi.waitFor(() => expect(two.events).toHaveLength(1));
    expect(one.events).toHaveLength(1);
    expect(two.events[0].data.token).toBe(3);
  });
});

/** Generated framework CSS uses a native constructed sheet, including under strict style-src. */
export function installInternalStyleSheet(root: ShadowRoot, marker: HTMLTemplateElement, initialText = "") {
  const sheet = new root.host.ownerDocument.defaultView!.CSSStyleSheet();
  let appliedText: string | undefined;
  // Even a non-CSS <style> is checked by Chromium's CSP when connected or changed.
  // An inert template keeps the generated text inspectable without parsing inline CSS.
  const update = (cssText: string): void => {
    if (marker.textContent !== cssText) marker.textContent = cssText;
    if (appliedText === cssText) return;
    sheet.replaceSync(cssText);
    appliedText = cssText;
  };
  update(initialText);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return {
    update,
    destroy() { root.adoptedStyleSheets = root.adoptedStyleSheets.filter(candidate => candidate !== sheet); marker.remove(); },
  };
}

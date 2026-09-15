window.__upstreamScriptProbe = {
  create() {
    const script = document.createElement("script");
    script.textContent = [
      "window.__upstreamScriptExecutions = (window.__upstreamScriptExecutions || 0) + 1;",
      "window.__upstreamScriptRealm = document.currentScript.ownerDocument.defaultView === window;",
    ].join("\n");
    return script;
  },
  append(target, script) {
    return document[target].appendChild(script);
  },
  insert(target, script, reference) {
    return document[target].insertBefore(script, reference);
  },
  remove(target, script) {
    return document[target].removeChild(script);
  },
};

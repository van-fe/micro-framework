// Classic fixture: every probe callback is created and executes in the application iframe.
(function () {
  const cachedDocument = window.document;
  const customType = 'remaining-custom-event';
  const events = { window: [], document: [] };
  const windowListener = (event) => events.window.push(event.detail);
  const documentListener = (event) => events.document.push(event.detail);
  window.addEventListener(customType, windowListener);
  document.addEventListener(customType, documentListener);
  const selections = [];
  window.__remainingProbe = {
    order: [],
    events,
    asyncExecutions: [],
    root: window,
    isIframeRealm: window !== parent && Object === window.Object && document.defaultView === window,
    async runOrdered() {
      const token = crypto.randomUUID();
      await Promise.all(['a', 'b', 'c'].map((name) => new Promise((resolve, reject) => {
        const script = cachedDocument.createElement('script');
        script.async = false;
        script.src = `/upstream-order-${name}.js?token=${token}`;
        script.onload = resolve;
        script.onerror = reject;
        cachedDocument.head.appendChild(script);
      })));
      return performance.getEntriesByType('resource')
        .filter((entry) => entry.name.includes(token))
        .sort((left, right) => left.responseEnd - right.responseEnd)
        .map((entry) => /upstream-order-(\w)\.js/.exec(entry.name)[1]);
    },
    runUmd(value) {
      // Lodash's supported self/global probe and traditional classic-script global this alias.
      const freeGlobal = typeof global === 'object' && global && global.Object === Object && global;
      const freeSelf = typeof self === 'object' && self && self.Object === Object && self;
      const root = freeGlobal || freeSelf || this.root;
      (function (rootObject, factory) { rootObject._ = factory(); })(root, () => ({ owner: value }));
      const classicThis = (function () { return this; })();
      return { rootIsWindow: root === window, aliasesAgree: classicThis === self && self === globalThis, value: window._.owner };
    },
    async runCachedDocument(value) {
      const append = (phase) => new Promise((resolve, reject) => {
        const script = cachedDocument.createElement('script');
        script.src = `/upstream-async-owned.js?phase=${phase}&owner=${encodeURIComponent(value)}`;
        script.onload = resolve;
        script.onerror = reject;
        cachedDocument[phase === 'promise' ? 'head' : 'body'].appendChild(script);
      });
      await Promise.resolve().then(() => append('promise'));
      await new Promise((resolve, reject) => setTimeout(() => append('timer').then(resolve, reject), 0));
    },
    dispatch(target, detail) {
      (target === 'window' ? window : document).dispatchEvent(new CustomEvent(customType, { detail }));
    },
    removeListeners() {
      window.removeEventListener(customType, windowListener);
      document.removeEventListener(customType, documentListener);
    },
    constructSheet() {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const root = element.attachShadow({ mode: 'open' });
      const text = document.createElement('span');
      text.textContent = 'constructed stylesheet';
      text.className = 'constructed-probe';
      root.appendChild(text);
      class ApplicationStyleSheet extends CSSStyleSheet {}
      const sheet = new CSSStyleSheet();
      const derived = new ApplicationStyleSheet();
      sheet.replaceSync('.constructed-probe { color: rgb(12, 34, 56); }');
      root.adoptedStyleSheets = [sheet, derived];
      return {
        root, sheet, text, instance: sheet instanceof CSSStyleSheet,
        subclass: derived instanceof ApplicationStyleSheet && derived instanceof CSSStyleSheet,
        prototype: Object.getPrototypeOf(sheet) === CSSStyleSheet.prototype
          && Object.getPrototypeOf(derived) === ApplicationStyleSheet.prototype,
      };
    },
    select(text) {
      let target = document.getElementById('selection-probe');
      if (!target) {
        target = document.createElement('p');
        target.id = 'selection-probe';
        target.textContent = text;
        document.body.appendChild(target);
      }
      const selection = getSelection();
      selection.selectAllChildren(target);
      selections.push(selection);
      return { node: target, selection, fromDocument: document.getSelection() };
    },
    readSelection() { return getSelection().toString(); },
    clearSelection() { getSelection().removeAllRanges(); },
    reinsert(type) {
      const node = document.createElement(type);
      const target = document.createElement('span');
      target.dataset.reinsertComplete = '';
      document.body.appendChild(target);
      if (type === 'style') node.textContent = '[data-reinsert-complete] { color: rgb(14, 28, 42); }';
      else { node.rel = 'stylesheet'; node.href = '/upstream-reinsert.css'; }
      return { node, target, append: () => document.head.appendChild(node), remove: () => document.head.removeChild(node) };
    },
  };
})();

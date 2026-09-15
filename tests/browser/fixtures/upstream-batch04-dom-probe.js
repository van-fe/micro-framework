window.batch04 = {
  identity: window,
  prototype(name) {
    String.prototype.__batch04Child = name;
    return { host: String.prototype.__batch04Host, child: String.prototype.__batch04Child };
  },
  inspectPrototype() { return String.prototype.__batch04Child; },
  events() {
    const state = { window: 0, document: 0 };
    window.addEventListener('batch04-private', () => state.window++);
    document.addEventListener('batch04-private', () => state.document++);
    return state;
  },
  dispatch() {
    window.dispatchEvent(new Event('batch04-private'));
    document.dispatchEvent(new Event('batch04-private'));
  },
  readonlyCreateElement() {
    const original = document.createElement;
    Object.defineProperty(document, 'createElement', { value: original, writable: false, configurable: false });
    const node = document.createElement('button');
    node.textContent = 'Frozen factory';
    document.body.append(node);
    return { same: document.createElement === original, node };
  },
  styles() {
    const first = document.createElement('style');
    first.textContent = '.batch04-first { color: rgb(11, 22, 33); }';
    document.head.appendChild(first);
    const second = document.createElement('style');
    second.textContent = '.batch04-second { width: 84px; color: rgb(44, 55, 66); }';
    first.insertAdjacentElement('afterend', second);
    document.body.innerHTML = '<p class="batch04-first">First</p><p class="batch04-second">Second</p>';
    return { first, second };
  },
};

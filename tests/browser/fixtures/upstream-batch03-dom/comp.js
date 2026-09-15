window.batch03ComponentRealm = window;
window.batch03Paths = [];
window.batch03Disconnected = 0;
const batch03Identity = crypto.randomUUID();
customElements.define('batch03-button', class extends HTMLElement {
  get applicationIdentity() { return batch03Identity; }
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:'open'});
    root.innerHTML = '<button type="button">Count: 0</button>';
    let count = 0;
    root.querySelector('button').onclick = () => { root.querySelector('button').textContent = 'Count: ' + ++count; };
    this.addEventListener('click', event => window.batch03Paths.push(event.composedPath().map(node => node.nodeName || 'Window')));
  }
  disconnectedCallback() { window.batch03Disconnected++; }
});
document.addEventListener('click', event => {
  window.batch03DocumentPath = event.composedPath().map(node => node.nodeName || 'Window');
});

const tag = 'native-batch03-' + crypto.randomUUID();
const node = document.createElement(tag);
parent.document.body.appendChild(node);
class NativeControl extends HTMLElement { connectedCallback() { this.textContent = 'native-connected'; } }
customElements.define(tag, NativeControl);
customElements.upgrade(node);
const beforeAdopt = node instanceof NativeControl;
document.adoptNode(node);
customElements.upgrade(node);
const afterAdopt = node instanceof NativeControl;
parent.document.body.appendChild(node);
window.batch03NativeResult = {tag,node,beforeAdopt,afterAdopt,connected:node.textContent};

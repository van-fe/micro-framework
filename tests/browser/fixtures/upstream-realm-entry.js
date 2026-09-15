// Run the probes in the application Realm: host-created callbacks cannot prove global semantics.
export function mount() {
  const events = [];
  const listener = (event) => events.push(event.detail.value);
  window.addEventListener('upstream-custom-event', listener);
  window.dispatchEvent(new CustomEvent('upstream-custom-event', { detail: { value: 'delivered' } }));
  window.removeEventListener('upstream-custom-event', listener);
  window.dispatchEvent(new CustomEvent('upstream-custom-event', { detail: { value: 'removed' } }));

  window.upstreamSetValue = function () { this.value = 'assigned'; };
  const receiver = {};
  window.upstreamSetValue.apply(receiver);
  const called = {};
  window.upstreamSetValue.call(called);
  const bound = {};
  window.upstreamSetValue.bind(bound)();
  window.upstreamSetValue.prototype.kind = 'application-constructor';
  const instance = new window.upstreamSetValue();
  const documentEvents = [];
  const documentListener = (event) => documentEvents.push(event.detail);
  document.addEventListener('upstream-document-event', documentListener);
  document.dispatchEvent(new CustomEvent('upstream-document-event', { detail: 'delivered' }));
  document.removeEventListener('upstream-document-event', documentListener);
  document.dispatchEvent(new CustomEvent('upstream-document-event', { detail: 'removed' }));
  window.__upstreamProbe = {
    events,
    documentEvents,
    receiver: receiver.value,
    called: called.value,
    bound: bound.value,
    constructed: instance.value,
    inherited: instance.kind,
    instance: instance instanceof window.upstreamSetValue,
    prototype: Object.getPrototypeOf(instance) === window.upstreamSetValue.prototype,
    leakedValue: window.value,
  };
}

export function unmount() {}

window.batch02CrossMessages = {
  async start(url) {
    const frame = document.createElement('iframe');
    const events = [];
    const rawEvents = [];
    const listener = event => {
      if (event.data?.batch02 !== 'cross-reply') return;
      rawEvents.push(event);
      events.push({
        token: event.data.token,
        origin: event.origin,
        requestOrigin: event.data.requestOrigin,
        correctSource: event.source === frame.contentWindow,
      });
    };
    window.addEventListener('message', listener);
    frame.src = url;
    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error('Cross-origin message iframe failed to load'));
    });
    document.body.appendChild(frame);
    await loaded;
    return {
      frame, events, rawEvents,
      request(token, origin) { frame.contentWindow.postMessage({ batch02: 'cross-request', token }, origin); },
      destroy() { window.removeEventListener('message', listener); frame.remove(); },
    };
  },
};
window.Batch02CrossMessage = { mount() {}, unmount() {} };

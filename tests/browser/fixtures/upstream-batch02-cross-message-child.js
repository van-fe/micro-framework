window.addEventListener('message', event => {
  if (event.data?.batch02 !== 'cross-request') return;
  const reply = {
    batch02: 'cross-reply', token: event.data.token, requestOrigin: event.origin,
  };
  if (event.data.token === 'ports') {
    const channel = new MessageChannel();
    channel.port1.onmessage = message => {
      channel.port1.postMessage('child-port:' + message.data);
      channel.port1.close();
    };
    parent.postMessage(reply, event.origin, [channel.port2]);
  } else parent.postMessage(reply, event.origin);
});

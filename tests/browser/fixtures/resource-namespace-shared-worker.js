const workerId = crypto.randomUUID();

self.addEventListener("connect", (event) => {
  const [port] = event.ports;
  port.addEventListener("message", (message) => {
    port.postMessage({ workerId, value: message.data });
  });
  port.start();
});

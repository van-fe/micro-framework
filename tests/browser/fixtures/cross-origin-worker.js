self.addEventListener("message", (event) => {
  self.postMessage({
    value: event.data.value,
    moduleUrl: import.meta.url,
    workerLocation: self.location.href,
  });
});

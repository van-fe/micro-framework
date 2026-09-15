self.addEventListener("message", (event) => {
  self.postMessage({
    value: event.data.value,
    scriptKind: "classic",
    workerLocation: self.location.href,
  });
});

/// <reference lib="webworker" />

self.addEventListener("message", (event: MessageEvent<{ values: readonly number[] }>) => {
  const values = event.data.values;
  self.postMessage({
    total: values.reduce((sum, value) => sum + value, 0),
    echoed: new Map([["worker", "module"]]),
  });
});

# Cross-tab communication

Same-origin applications can use native BroadcastChannel. Runtime maps physical names to:

```text
micro-app:<application-name>:<logical-channel-name>
```

The application sees only the logical name:

```ts
const channel = new BroadcastChannel("orders-events");

channel.addEventListener("message", (event) => {
  console.log(event.data);
});

channel.postMessage({ type: "order-updated", id: "A-1024" });
```

The prefix includes the application name, not Runtime, instance, or tab IDs. Consequently:

- Tabs with the same origin, application name, and logical channel communicate.
- Different application names remain isolated even with identical logical channels.
- Native structured clone excludes functions, DOM nodes, and shared object identity.
- Realm destruction closes every channel created by that Realm.

Three-engine E2E tests open two tabs and verify bidirectional messages, cross-application isolation, and cleanup. Cross-origin strong-isolation guests need an explicit host messaging protocol instead.

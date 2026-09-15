import {
  getDefaultRuntime,
  initGlobalState,
  registerMicroApps,
  runAfterFirstMounted,
  start,
} from "@micro-framework/runtime";

const status = document.querySelector<HTMLElement>("#compat-status")!;
const stateStatus = document.querySelector<HTMLElement>("#compat-state")!;
const state = initGlobalState({ tenant: "north", revision: 0 });

state.onGlobalStateChange((next) => {
  stateStatus.textContent = `tenant ${String(next.tenant)}, revision ${String(next.revision)}`;
}, true);

registerMicroApps([
  {
    name: "compat-orders",
    entry: "http://127.0.0.1:5174/micro.html",
    container: "#compat-slot",
    activeRule: () => true,
    props: { title: "Compatibility API orders" },
  },
], {
  beforeLoad: [(application) => { status.textContent = `loading ${application.name}`; }],
  afterMount: [(application) => { status.textContent = `mounted ${application.name}`; }],
});

runAfterFirstMounted(() => {
  state.setGlobalState({ revision: 1 });
});

declare global {
  interface Window {
    __compatRuntime__?: ReturnType<typeof getDefaultRuntime>;
  }
}

window.__compatRuntime__ = getDefaultRuntime();
await start({ prefetch: false, singular: false });

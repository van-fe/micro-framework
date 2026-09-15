import { installStrongIsolationGuest } from "@micro-framework/strong-isolation";

interface GuestProps {
  title: string;
  count: number;
  createdAt: Date;
  labels: Map<string, string>;
}

let localClicks = 0;

function render(props: GuestProps & {
  name: string;
  container: HTMLElement;
  $isolation: { instanceId: string };
}): void {
  let parentAccess = "allowed";
  try { void window.parent.document.body; }
  catch { parentAccess = "blocked"; }
  const main = document.createElement("main");
  main.innerHTML = `
    <p data-guest-name>${props.name}</p>
    <h1 data-guest-title>${props.title}</h1>
    <p data-guest-count>${props.count}</p>
    <p data-guest-date>${props.createdAt.toISOString()}</p>
    <p data-guest-label>${props.labels.get("region") ?? "missing"}</p>
    <p data-parent-access>${parentAccess}</p>
    <p data-instance-id>${props.$isolation.instanceId}</p>
    <button type="button">Guest clicks: <span>0</span></button>
  `;
  main.querySelector("button")!.addEventListener("click", () => {
    localClicks += 1;
    main.querySelector("button span")!.textContent = String(localClicks);
  });
  props.container.replaceChildren(main);
}

installStrongIsolationGuest<GuestProps>({
  bootstrap(props) {
    document.documentElement.dataset.bootstrapInstance = props.$isolation.instanceId;
  },
  mount(props) {
    render(props);
    document.documentElement.dataset.lifecycle = "mounted";
  },
  activate() {
    document.documentElement.dataset.lifecycle = "active";
  },
  deactivate() {
    document.documentElement.dataset.lifecycle = "inactive";
  },
  update(props) {
    render(props);
    document.documentElement.dataset.lifecycle = "updated";
  },
  unmount(props) {
    props.container.replaceChildren();
    document.documentElement.dataset.lifecycle = "unmounted";
  },
  dispose() {
    document.documentElement.dataset.lifecycle = "disposed";
  },
}, {
  allowedParentOrigins: ["http://127.0.0.1:5173"],
});

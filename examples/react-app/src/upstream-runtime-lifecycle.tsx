import { createRoot, type Root } from "react-dom/client";
import { useState } from "react";
import { Modal } from "antd";
import type { AppProps } from "@micro-framework/runtime";
import "antd/dist/reset.css";

interface RegressionProps {
  title: string;
  delayedUnmount?: boolean;
  delayedDeactivate?: boolean;
  confirmNavigation?: boolean;
}
interface UnmountService { wait(): Promise<void>; }
let root: Root | undefined;

function RegressionApp({ props }: { props: AppProps<RegressionProps> }) {
  const [count, setCount] = useState(0);
  return <section data-runtime-react="">
    <button onClick={() => setCount((value) => value + 1)}>{props.title}: {count}</button>
    {props.confirmNavigation && <button onClick={() => Modal.confirm({
      title: "Switch application from confirm",
      content: "The next application opens while this confirmation finishes.",
      okText: "Switch to B",
      // This test application explicitly asks its same-origin host to navigate.
      onOk: () => { window.parent.location.hash = "/b"; },
    })}>Open switch confirmation</button>}
  </section>;
}

export function mount(props: AppProps<RegressionProps>): void {
  root = createRoot(props.container);
  root.render(<RegressionApp props={props} />);
}

async function waitForLifecycleRelease(props: AppProps<RegressionProps>): Promise<void> {
  const service = props.$runtime.services.get<UnmountService>("unmount");
  if (!service) throw new Error("The delayed lifecycle service is required.");
  await service.wait();
}

export async function deactivate(props: AppProps<RegressionProps>): Promise<void> {
  if (props.delayedDeactivate) await waitForLifecycleRelease(props);
}

export async function unmount(props: AppProps<RegressionProps>): Promise<void> {
  if (props.delayedUnmount) await waitForLifecycleRelease(props);
  root?.unmount();
  root = undefined;
}

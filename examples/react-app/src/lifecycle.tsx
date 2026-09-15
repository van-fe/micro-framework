import { createReactLifecycle } from "@micro-framework/adapter-react";
import type { AppProps } from "@micro-framework/runtime";
import { App } from "./App";
import "antd/dist/reset.css";
import "./app.css";

interface BusinessProps {
  title: string;
  locale?: "zh-CN" | "en-US";
  market?: string;
  period?: string;
}

declare global {
  interface Window {
    __reactRealm__?: string;
  }
}

const lifecycle = createReactLifecycle<BusinessProps>({
  render(props: AppProps<BusinessProps>) {
    return (
      <App
        title={props.title}
        instanceId={props.$runtime.instanceId}
        locale={props.locale}
        market={props.market}
        period={props.period}
      />
    );
  },
});

export function bootstrap(): void {
  window.__reactRealm__ = "react-iframe";
}

export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;

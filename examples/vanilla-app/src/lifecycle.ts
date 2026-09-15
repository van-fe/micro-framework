import { createVanillaLifecycle } from "@micro-framework/adapter-vanilla";
import { createVanillaView, type Locale, type VanillaView } from "./view";

interface BusinessProps {
  title: string;
  market?: string;
  locale?: Locale;
}

declare global {
  interface Window {
    __realmCollision__?: string;
    __vanillaBootstrapCount__?: number;
    __vanillaInstanceId__?: string;
    __vanillaModuleCount__?: number;
    __persistentBootstrapCount__?: number;
    __visualSurfaceProbe__?: {
      containerIsBody: boolean;
      overlayIsDedicated: boolean;
    };
    __rpcProbe__?: {
      inputValue: string;
      receivedValue: string;
      mutatedValue: string;
    };
    __capabilityProbe__?: {
      features: unknown;
      activation: unknown;
      deniedPopup: unknown;
    };
  }
}

let view: VanillaView | undefined;
let moduleCount = 0;

const lifecycle = createVanillaLifecycle<BusinessProps>({
  async bootstrap(props) {
    window.__realmCollision__ = "micro-app";
    window.__vanillaBootstrapCount__ = (window.__vanillaBootstrapCount__ ?? 0) + 1;
    window.__vanillaInstanceId__ = props.$runtime.instanceId;
    window.__vanillaModuleCount__ = ++moduleCount;
    const persistentBootstrapCount = (await props.$runtime.storage.get<number>("bootstrap-count") ?? 0) + 1;
    await props.$runtime.storage.set("bootstrap-count", persistentBootstrapCount);
    window.__persistentBootstrapCount__ = persistentBootstrapCount;
    window.__visualSurfaceProbe__ = {
      containerIsBody: props.container === document.body,
      overlayIsDedicated: props.overlayContainer === document.querySelector("micro-app-overlay"),
    };
    const probeService = props.$runtime.services.get<{
      transform(input: { value: string }): Promise<{ value: string }>;
    }>("probe");
    if (probeService) {
      const rpcInput = { value: "application-input" };
      const rpcResult = await probeService.transform(rpcInput);
      const receivedValue = rpcResult.value;
      rpcResult.value = "application-mutated";
      window.__rpcProbe__ = {
        inputValue: rpcInput.value,
        receivedValue,
        mutatedValue: rpcResult.value,
      };
    }
    const [features, activation, deniedPopup] = await Promise.all([
      props.$runtime.capabilities.invoke("environment.features"),
      props.$runtime.capabilities.invoke("user-activation.query"),
      props.$runtime.capabilities.invoke("popup.open", { url: "/must-not-open" }),
    ]);
    window.__capabilityProbe__ = { features, activation, deniedPopup };
  },
  render(props) {
    view = createVanillaView(
      document.body,
      props.title,
      props.$runtime.instanceId,
      props.market ?? "North America",
      props.locale ?? "zh-CN",
    );
    return () => {
      view?.destroy();
      view = undefined;
    };
  },
  update(props) {
    view?.update(props.title, props.market, props.locale);
  },
});

export const bootstrap = lifecycle.bootstrap;
export const mount = lifecycle.mount;
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;

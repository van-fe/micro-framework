import { createVanillaLifecycle } from "@micro-framework/adapter-vanilla";
import { mountBenchmarkWorkload } from "./benchmark-workload";

const lifecycle = createVanillaLifecycle({
  render(props) {
    const workload = mountBenchmarkWorkload(
      props.container,
      props.$runtime.instanceId,
      window as unknown as Record<string, unknown>,
    );
    return () => workload.dispose();
  },
});

export const mount = lifecycle.mount;
export const unmount = lifecycle.unmount;

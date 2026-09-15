import { mount, scenarios, type Scenario } from "./lifecycle";
const scenario = new URL(location.href).searchParams.get("scenario") ?? "ant-select";
if (!scenarios.includes(scenario as Scenario)) throw new Error(`Unknown scenario ${scenario}`);
const container = document.querySelector<HTMLElement>("#batch02")!;
await mount({ container, scenario } as Parameters<typeof mount>[0]);

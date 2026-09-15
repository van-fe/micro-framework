import { renderScenario, scenarios, type Scenario } from "./lifecycle";

const requested = new URL(location.href).searchParams.get("scenario") ?? "x6";
if (!scenarios.includes(requested as Scenario)) throw new Error(`Unknown component scenario: ${requested}`);
const container = document.querySelector<HTMLElement>("#upstream-components")!;
await renderScenario(container, requested as Scenario);

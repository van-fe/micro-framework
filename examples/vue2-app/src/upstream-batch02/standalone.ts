const container = document.querySelector<HTMLElement>("#batch02")!;
const selected = new URL(location.href).searchParams.get("scenario");
if (selected === "style-prop") {
  const { mount } = await import("./style-prop-entry");
  mount({ container, label: "Initial business label" } as Parameters<typeof mount>[0]);
} else {
  const { mount } = await import("./drawer-entry");
  mount({ container, local: new URL(location.href).searchParams.get("local") === "true" });
}
export {};

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

export function render(container: HTMLElement): () => void {
  const root = createRoot(container);
  root.render(createElement("section", null,
    createElement("h2", null, "Recharts scrolling hit test"),
    createElement(BarChart, {
      width: 680, height: 380,
      data: [{ name: "North", value: 25 }, { name: "South", value: 50 }, { name: "East", value: 75 }],
      margin: { top: 20, bottom: 20, left: 20, right: 20 },
    },
    createElement(XAxis, { dataKey: "name" }),
    createElement(YAxis),
    createElement(Tooltip),
    createElement(Bar, { dataKey: "value", fill: "#4169b1" }),
    ),
  ));
  return () => root.unmount();
}

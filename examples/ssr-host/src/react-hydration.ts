import { createElement, useState } from "react";
import { createReactLifecycle } from "@micro-framework/adapter-react";

function Orders({ title }: { title: string }) {
  const [count, setCount] = useState(5);
  return createElement("article", { "data-ssr-root": "" },
    createElement("h1", { "data-ssr-title": "" }, title),
    createElement("button", { type: "button", onClick: () => setCount(count + 1) }, `SSR count: ${count}`));
}
const lifecycle = createReactLifecycle<{ title: string }>({ render: (props) => createElement(Orders, props) });
export const { hydrate, mount, update, unmount } = lifecycle;

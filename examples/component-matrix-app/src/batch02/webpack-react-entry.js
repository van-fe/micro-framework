import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";

let reactRoot;
let element;
function Application() {
  const [message, setMessage] = useState("Cold chunk");
  return createElement("div", null,
    createElement("p", { "data-chunk-message": true }, message),
    createElement("button", { onClick: async () => {
      const chunk = await import("./webpack-react-lazy.js");
      setMessage(chunk.message);
      element.dataset.setterWrites = String(window.__batch02ChunkSetterWrites);
    } }, "Load real webpack chunk"),
  );
}

export function mount(props) {
  element = document.createElement("section");
  element.className = "batch02-webpack";
  element.dataset.ready = "true";
  element.dataset.setterWrites = String(window.__batch02ChunkSetterWrites);
  element.dataset.realm = window === globalThis && window !== parent ? "application" : "incorrect";
  props.container.append(element);
  reactRoot = createRoot(element);
  reactRoot.render(createElement(Application));
}
export function unmount() { reactRoot?.unmount(); element?.remove(); reactRoot = undefined; element = undefined; }

import { createRoot } from "react-dom/client";
import { App } from "./App";
import "antd/dist/reset.css";
import "./app.css";

createRoot(document.querySelector("#app")!).render(
  <App title="Standalone React application" instanceId="standalone" locale="en-US" />,
);

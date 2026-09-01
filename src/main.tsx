import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import { cursorArt } from "@/lib/game-data";
import { initializeRendererCrashReporting } from "./lib/crash-reporting";
import "@/features/alchemy/shared/stores/error-log-store";

initializeRendererCrashReporting();

const cursorStyle = document.createElement("style");
cursorStyle.textContent = `
  html { cursor: url("${cursorArt.pointer}") 0 0, auto; }
  .cursor-pointer,
  button:not(:disabled),
  a,
  [role="button"],
  input[type="submit"],
  input[type="button"],
  input[type="reset"],
  summary,
  .cursor-default,
  .cursor-help,
  .cursor-not-allowed {
    cursor: url("${cursorArt.pointer}") 0 0, auto;
  }
`;
document.head.appendChild(cursorStyle);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const idle: (cb: () => void) => void =
  typeof globalThis.requestIdleCallback === "function"
    ? (cb) => globalThis.requestIdleCallback(cb)
    : (cb) => globalThis.setTimeout(cb, 0);
idle(() => {
  void import("./lib/validate-startup").then((m) => m.runStartupValidation());
});

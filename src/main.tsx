import { localizeStartupSplash } from "@/app/startup-splash";
import { loadBundledCatalogs } from "@/app/load-localization";
import { initializeLanguage } from "@/lib/localization/language";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import { cursorArt } from "@/lib/game-data";
import { initializeRendererCrashReporting } from "./lib/crash-reporting";
import { initErrorLogStore } from "@/features/alchemy/shared/stores/react/error-log-store";
import { initDeviceDisplayPreferences } from "@/features/alchemy/shared/stores/react/device-display-store";

initErrorLogStore();
initDeviceDisplayPreferences();

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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

async function boot(): Promise<void> {
  try {
    await loadBundledCatalogs();
  } catch (error) {
    console.error("Localization startup failed; using English", error);
  }
  await initializeLanguage();
  localizeStartupSplash();
  ReactDOM.createRoot(rootElement!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void boot();

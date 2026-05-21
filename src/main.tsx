// React entry point for the game client.
// Depends on global styles and App only.
// Vite mounts this into #root; gameplay logic starts inside App/controllers.
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./lib/validate-startup";
import "./index.css";
import { cursorArt } from "./lib/game-data/assets";

// Use pointer_c_shaded for all cursor variants — no special effects.
// Same image throughout; different CSS fallbacks if the image fails.
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

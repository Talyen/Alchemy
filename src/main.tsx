// React entry point for the game client.
// Depends on global styles and App only.
// Vite mounts this into #root; gameplay logic starts inside App/controllers.
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./lib/validate-startup";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

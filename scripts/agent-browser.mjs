#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  captureBrowser,
  browserSocketDirectory,
  closeTaskBrowsers,
  recoverBrowsers,
  ROOT,
  taskKey,
  watchBrowser,
} from "./lib/agent-browser-session.mjs";

const args = process.argv.slice(2);
const key = taskKey();
const managed = key && process.platform !== "win32";
// Global switches may precede the action. Value options consume their next argument.
const switches = new Set([
  "--json",
  "--headed",
  "--debug",
  "--annotate",
  "--webgpu",
  "--content-boundaries",
  "--ignore-https-errors",
  "--allow-file-access",
  "--no-ca-cert",
  "--pin-tab",
  "--no-pin-tab",
  "--no-auto-dialog",
  "--confirm-interactive",
  "--verbose",
  "--quiet",
  "-v",
  "-q",
]);
let actionIndex = 0;
while (args[actionIndex]?.startsWith("-")) {
  const option = args[actionIndex++];
  if (option.includes("=")) continue;
  if (switches.has(option)) {
    if (["true", "false"].includes(args[actionIndex])) actionIndex++;
  } else actionIndex++;
}
const action = args[actionIndex];
try {
  if (args[0] === "--watch") {
    if (args.length !== 2) throw new Error("Internal watcher needs one ownership record");
    await watchBrowser(args[1]);
  } else if (args[0] === "--cleanup-task") {
    if (args.length !== 1) throw new Error("Internal cleanup takes no arguments");
    await closeTaskBrowsers();
  } else {
    if (args.length === 0) throw new Error("Usage: npm run agent:browser -- <agent-browser action and arguments>");
    if (
      managed &&
      args.some((arg) => /^(?:--session|--namespace|--cdp|--auto-connect|--provider|--profile)(?:=|$)/u.test(arg))
    )
      throw new Error("Managed reviews select their own task session; use the native CLI for user-attached browsers");
    if (managed) await recoverBrowsers();
    const session = `alchemy-${key}`;
    const runBrowser = async (command) => {
      const child = spawn(
        "agent-browser",
        [...(managed ? ["--session", session, "--namespace", ""] : []), ...command],
        {
          cwd: ROOT,
          stdio: ["inherit", managed ? "pipe" : "inherit", "inherit"],
          ...(managed
            ? {
                env: {
                  ...process.env,
                  AGENT_BROWSER_SOCKET_DIR: browserSocketDirectory(),
                  AGENT_BROWSER_NAMESPACE: "",
                },
              }
            : {}),
        },
      );
      let output = "";
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        output += chunk;
      });
      return new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve({ code: code ?? 1, output }));
      });
    };
    let result = await runBrowser(args);
    if (managed) {
      if (action === "close") await closeTaskBrowsers();
      // Getters and other actions can also start the CLI's daemon implicitly.
      else {
        // Initialize once per daemon so later navigation preserves deliberate resizes.
        const created = await captureBrowser(session, ROOT, key, result.code === 0 && action === "open");
        const explicitViewport = action === "set" && ["viewport", "device"].includes(args[actionIndex + 1]);
        if (created && !explicitViewport) {
          const resized = await runBrowser(["set", "viewport", "1920", "1080"]);
          if (resized.code !== 0) {
            await closeTaskBrowsers();
            throw new Error("Default 16:9 browser viewport could not be applied; the new session was closed.");
          }
          // Fresh-daemon captures ran before initialization. Publish only the
          // capture at the configured size; never repeat mutating actions.
          if (result.code === 0 && ["screenshot", "snapshot"].includes(action)) result = await runBrowser(args);
        }
      }
    }
    process.stdout.write(result.output);
    process.exitCode = result.code;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

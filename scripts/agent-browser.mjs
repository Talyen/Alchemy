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
          stdio: "inherit",
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
      return new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve(code ?? 1));
      });
    };
    const code = await runBrowser(args);
    if (managed) {
      if (args.includes("close")) await closeTaskBrowsers();
      // Getters and other actions can also start the CLI's daemon implicitly.
      else {
        // Initialize once per daemon so later navigation preserves deliberate resizes.
        const created = await captureBrowser(session, ROOT, key, code === 0 && args.includes("open"));
        const explicitViewport = args[0] === "set" && ["viewport", "device"].includes(args[1]);
        if (created && !explicitViewport) {
          const resized = await runBrowser(["set", "viewport", "1920", "1080"]);
          if (resized !== 0) {
            await closeTaskBrowsers();
            throw new Error("Default 16:9 browser viewport could not be applied; the new session was closed.");
          }
        }
      }
    }
    process.exitCode = code;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

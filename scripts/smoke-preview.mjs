// Smoke-test a production Vite build via `vite preview` (CI / release).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { isMainModule } from "./lib/is-main-module.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
const DEFAULT_PORT = 4174;
const TIMEOUT_MS = 30_000;
const POLL_MS = 250;

/**
 * @param {number} port
 */
async function waitForPreview(port) {
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Preview not ready yet.
    }
    await delay(POLL_MS);
  }

  throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s waiting for preview at ${url}`);
}

/**
 * @param {{ port?: number }} [options]
 */
export async function smokePreview(options = {}) {
  const port = options.port ?? Number.parseInt(process.env.ALCHEMY_SMOKE_PORT ?? String(DEFAULT_PORT), 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid preview port: ${port}`);
  }

  const child = spawn(
    process.execPath,
    [viteCli, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: root, stdio: "ignore" },
  );

  let exitError = null;
  child.on("error", (error) => {
    exitError = error;
  });
  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      exitError = new Error(`vite preview exited with code ${code}${signal ? ` (${signal})` : ""}`);
    }
  });

  try {
    await waitForPreview(port);
    if (exitError) throw exitError;
    const response = await fetch(`http://127.0.0.1:${port}`);
    if (!response.ok) {
      throw new Error(`Preview responded with HTTP ${response.status}`);
    }
  } finally {
    if (!child.killed) {
      child.kill("SIGTERM");
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2_000)]);
      if (!child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          // Process already exited.
        }
      }
    }
  }
}

if (isMainModule(import.meta.url)) {
  smokePreview().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

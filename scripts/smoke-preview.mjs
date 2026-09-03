// Smoke-test a production Vite build via `vite preview` (CI / release).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { isMainModule } from "./lib/is-main-module.mjs";
import { waitForHttp } from "./lib/wait-for-http.mjs";
import { parsePort, SMOKE_PREVIEW_PORT } from "./lib/dev-port.mjs";
import { resolveViteBin } from "./lib/vite-bin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = SMOKE_PREVIEW_PORT;
const TIMEOUT_MS = 30_000;
const POLL_MS = 250;

/**
 * @param {number} port
 */
async function waitForPreview(port) {
  const url = `http://127.0.0.1:${port}`;
  return waitForHttp(url, { timeoutMs: TIMEOUT_MS, pollMs: POLL_MS });
}

/**
 * Return the executable resources that prove Vite's generated HTML points at
 * loadable application code and styles, not merely a successful HTML response.
 * @param {string} html
 * @param {string} documentUrl
 */
export function extractBuildResourceUrls(html, documentUrl) {
  const urls = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)) {
    urls.add(new URL(match[1], documentUrl).href);
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/giu)) {
    urls.add(new URL(match[1], documentUrl).href);
  }
  return [...urls];
}

async function verifyBuildResources(html, documentUrl) {
  const resourceUrls = extractBuildResourceUrls(html, documentUrl);
  if (resourceUrls.length === 0) {
    throw new Error("Preview HTML did not reference any executable build resources");
  }

  await Promise.all(
    resourceUrls.map(async (resourceUrl) => {
      const response = await fetch(resourceUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) {
        throw new Error(`Build resource responded with HTTP ${response.status}: ${resourceUrl}`);
      }
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) {
        throw new Error(`Build resource was empty: ${resourceUrl}`);
      }
    }),
  );
}

export function watchChildProcess(child) {
  let exited = false;
  const exit = new Promise((resolve) => {
    child.once("error", (error) => {
      if (exited) return;
      exited = true;
      resolve({ kind: "error", error });
    });
    child.once("exit", (code, signal) => {
      if (exited) return;
      exited = true;
      resolve({ kind: "exit", code, signal });
    });
  });
  return { exit, hasExited: () => exited };
}

function earlyExitError(label, outcome) {
  if (outcome.kind === "error") return outcome.error;
  const detail = outcome.signal ? `signal ${outcome.signal}` : `code ${outcome.code ?? "unknown"}`;
  return new Error(`${label} exited before it became ready (${detail})`);
}

export async function waitForProcessReady(readiness, watcher, label) {
  const result = await Promise.race([
    readiness.then((value) => ({ kind: "ready", value })),
    watcher.exit.then((outcome) => ({ kind: "stopped", outcome })),
  ]);
  if (result.kind === "ready") return result.value;
  throw earlyExitError(label, result.outcome);
}

function signalChild(child, signal) {
  try {
    child.kill(signal);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ESRCH") throw error;
  }
}

export async function stopChildProcess(child, watcher, { graceMs = 2_000, label = "child process" } = {}) {
  if (watcher.hasExited()) return;

  signalChild(child, "SIGTERM");
  const exitedGracefully = await Promise.race([watcher.exit.then(() => true), delay(graceMs, false)]);
  if (exitedGracefully) return;

  signalChild(child, "SIGKILL");
  const exitedForcefully = await Promise.race([watcher.exit.then(() => true), delay(graceMs, false)]);
  if (!exitedForcefully) {
    throw new Error(`${label} did not exit after SIGKILL`);
  }
}

/**
 * @param {{ port?: number }} [options]
 */
export async function smokePreview(options = {}) {
  const port = parsePort(options.port ?? process.env.ALCHEMY_SMOKE_PORT ?? DEFAULT_PORT, "ALCHEMY_SMOKE_PORT");

  const child = spawn(
    process.execPath,
    [resolveViteBin(), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: root,
      stdio: "ignore",
    },
  );
  const watcher = watchChildProcess(child);
  let operationError;

  try {
    await waitForProcessReady(waitForPreview(port), watcher, "vite preview");
    const documentUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Preview responded with HTTP ${response.status}`);
    }
    await verifyBuildResources(await response.text(), documentUrl);
  } catch (error) {
    operationError = error;
  }

  let teardownError;
  try {
    await stopChildProcess(child, watcher, { label: "vite preview" });
  } catch (error) {
    teardownError = error;
  }

  if (operationError) {
    if (teardownError) {
      console.error(
        `Failed to stop vite preview after its primary failure: ${teardownError instanceof Error ? teardownError.message : teardownError}`,
      );
    }
    throw operationError;
  }
  if (teardownError) throw teardownError;
}

if (isMainModule(import.meta.url)) {
  smokePreview().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

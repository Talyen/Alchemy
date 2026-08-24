// Smoke-test a production Vite build via `vite preview` (CI / release).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { isMainModule } from "./lib/is-main-module.mjs";
import { waitForHttp } from "./lib/wait-for-http.mjs";
import { SMOKE_PREVIEW_PORT } from "./lib/dev-port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
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
    const documentUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Preview responded with HTTP ${response.status}`);
    }
    await verifyBuildResources(await response.text(), documentUrl);
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

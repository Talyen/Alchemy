// Smoke-test a production Vite build using an owned preview server.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { isMainModule } from "./lib/is-main-module.mjs";
import { parsePort, SMOKE_PREVIEW_PORT } from "./lib/dev-port.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Return the executable resources that prove Vite's generated HTML points at
 * loadable application code and styles, not merely a successful HTML response.
 * @param {string} html
 * @param {string} documentUrl
 */
export function extractBuildResources(html, documentUrl) {
  const resources = new Map();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)) {
    resources.set(new URL(match[1], documentUrl).href, "script");
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/giu)) {
    resources.set(new URL(match[1], documentUrl).href, "style");
  }
  return [...resources].map(([url, type]) => ({ url, type }));
}

export async function verifyBuildResources(html, documentUrl) {
  const resources = extractBuildResources(html, documentUrl);
  if (!resources.some(({ type }) => type === "script")) {
    throw new Error("Preview HTML did not reference an application script");
  }

  await Promise.all(
    resources.map(async ({ url: resourceUrl, type }) => {
      const response = await fetch(resourceUrl, {
        signal: AbortSignal.timeout(5_000),
        headers: { Connection: "close" },
      });
      if (!response.ok) {
        throw new Error(`Build resource responded with HTTP ${response.status}: ${resourceUrl}`);
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      const expectedTypes = type === "script" ? ["text/javascript", "application/javascript"] : ["text/css"];
      if (!expectedTypes.includes(contentType)) {
        throw new Error(`Build resource has unexpected content type ${contentType ?? "(missing)"}: ${resourceUrl}`);
      }
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) {
        throw new Error(`Build resource was empty: ${resourceUrl}`);
      }
    }),
  );
}

async function verifyMusicResource(rootDir, documentUrl) {
  const musicDir = join(rootDir, "public", "Music");
  const track = (await readdir(musicDir)).filter((name) => name.endsWith(".mp3")).sort()[0];
  if (!track) throw new Error("No authored MP3 music found for preview verification.");
  const response = await fetch(new URL(`Music/${encodeURIComponent(track)}`, documentUrl), {
    signal: AbortSignal.timeout(5_000),
    headers: { Connection: "close" },
  });
  if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "audio/mpeg") {
    throw new Error(`Music resource is unavailable or has unexpected content type: ${track}`);
  }
  const expected = await readFile(join(musicDir, track));
  if (expected.length === 0 || !Buffer.from(await response.arrayBuffer()).equals(expected)) {
    throw new Error(`Music resource differs from authored output: ${track}`);
  }
}

export async function smokePreview(options = {}) {
  const port =
    options.port === 0
      ? 0
      : parsePort(options.port ?? process.env.ALCHEMY_SMOKE_PORT ?? SMOKE_PREVIEW_PORT, "ALCHEMY_SMOKE_PORT");
  // preview() resolves only after our listener binds; an occupied port rejects.
  const server = await preview({
    root: options.rootDir ?? root,
    preview: { host: "127.0.0.1", port, strictPort: true, open: false },
  });
  // One-shot requests must not pool sockets across preview server restarts.
  try {
    const documentUrl = `http://127.0.0.1:${server.httpServer.address().port}`;
    const response = await fetch(documentUrl, { signal: AbortSignal.timeout(5_000), headers: { Connection: "close" } });
    if (!response.ok) throw new Error(`Preview responded with HTTP ${response.status}`);
    await verifyBuildResources(await response.text(), documentUrl);
    await verifyMusicResource(options.rootDir ?? root, documentUrl);
  } finally {
    await server.close();
  }
}

if (isMainModule(import.meta.url)) {
  smokePreview().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

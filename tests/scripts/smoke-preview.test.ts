import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preview, type PreviewServer } from "vite";

vi.mock("vite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vite")>();
  return { ...actual, preview: vi.fn(actual.preview) };
});
import { extractBuildResources, smokePreview, verifyBuildResources } from "../../scripts/smoke-preview.mjs";

describe("extractBuildResources", () => {
  it("resolves Vite scripts and styles for web builds", () => {
    const html = `
      <link rel="stylesheet" href="/assets/index.css">
      <script type="module" src="/assets/index.js"></script>
    `;

    expect(extractBuildResources(html, "http://127.0.0.1:4174/")).toEqual([
      { url: "http://127.0.0.1:4174/assets/index.js", type: "script" },
      { url: "http://127.0.0.1:4174/assets/index.css", type: "style" },
    ]);
  });

  it("resolves relative resources emitted by desktop mode", () => {
    const html = `<script type="module" src="./assets/index.js"></script>`;
    expect(extractBuildResources(html, "http://127.0.0.1:4174/")).toEqual([
      { url: "http://127.0.0.1:4174/assets/index.js", type: "script" },
    ]);
  });
});

describe("production build resources", () => {
  const html = '<script src="/assets/index.js"></script><link rel="stylesheet" href="/assets/index.css">';
  const url = "http://127.0.0.1:4174/";
  afterEach(() => vi.unstubAllGlobals());

  it("accepts nonempty JavaScript and CSS with their expected content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (resource: string) =>
          new Response("content", {
            headers: { "content-type": resource.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css" },
          }),
      ),
    );
    await expect(verifyBuildResources(html, url)).resolves.toBeUndefined();
  });

  it.each(["text/html", "text/plain", ""])(
    "rejects a successful response with content type %s",
    async (contentType) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("fallback", { headers: { "content-type": contentType } })),
      );
      await expect(verifyBuildResources(html, url)).rejects.toThrow("unexpected content type");
    },
  );

  it("rejects a stylesheet-only page before fetching resources", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(verifyBuildResources('<link rel="stylesheet" href="/assets/index.css">', url)).rejects.toThrow(
      "application script",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([404, 200])("rejects an unavailable or empty resource (HTTP %s)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status, headers: { "content-type": "text/javascript" } })),
    );
    await expect(verifyBuildResources('<script src="/assets/index.js"></script>', url)).rejects.toThrow(
      status === 200 ? "empty" : "HTTP 404",
    );
  });
});

describe("smoke preview server ownership", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });
  function buildFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-preview-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "dist"));
    fs.writeFileSync(path.join(root, "dist/index.html"), '<script src="/app.js"></script>');
    fs.writeFileSync(path.join(root, "dist/app.js"), 'console.log("app")');
    fs.mkdirSync(path.join(root, "public/Music"), { recursive: true });
    fs.mkdirSync(path.join(root, "dist/Music"));
    fs.writeFileSync(path.join(root, "public/Music/Menu 1.mp3"), "authored music bytes");
    fs.copyFileSync(path.join(root, "public/Music/Menu 1.mp3"), path.join(root, "dist/Music/Menu 1.mp3"));
    return root;
  }
  async function listen(server: ReturnType<typeof createServer>, port = 0) {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    return (server.address() as AddressInfo).port;
  }
  async function close(server: ReturnType<typeof createServer>) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  it("rejects missing and corrupt packaged music even when application resources load", async () => {
    const rootDir = buildFixture();
    const music = path.join(rootDir, "dist/Music/Menu 1.mp3");
    fs.unlinkSync(music);
    await expect(smokePreview({ port: 0, rootDir })).rejects.toThrow("Music resource is unavailable");
    fs.writeFileSync(music, "corrupt music bytes");
    await expect(smokePreview({ port: 0, rootDir })).rejects.toThrow("Music resource differs");
  });

  it("rejects invalid ports before starting Vite", async () => {
    await expect(smokePreview({ port: 70_000 })).rejects.toThrow("Invalid ALCHEMY_SMOKE_PORT: 70000");
  });

  it("rejects an occupied port without testing or stopping the unrelated server", async () => {
    const respond = vi.fn((_request: IncomingMessage, response: ServerResponse) => {
      response.setHeader("Content-Type", "text/javascript");
      response.end('<script src="/app.js"></script>');
    });
    const unrelated = createServer(respond);
    const port = await listen(unrelated);
    try {
      await expect(smokePreview({ port, rootDir: buildFixture() })).rejects.toThrow("already in use");
      expect(respond).not.toHaveBeenCalled();
      expect(unrelated.listening).toBe(true);
    } finally {
      await close(unrelated);
    }
  });

  it("checks actual build resources and releases its port after success and failure", async () => {
    const rootDir = buildFixture();
    await smokePreview({ port: 0, rootDir });
    const succeeded = await (vi.mocked(preview).mock.results.at(-1)?.value as Promise<PreviewServer>);
    expect(succeeded.httpServer.listening).toBe(false);
    fs.unlinkSync(path.join(rootDir, "dist/app.js"));
    await expect(smokePreview({ port: 0, rootDir })).rejects.toThrow("unexpected content type");
    const failed = await (vi.mocked(preview).mock.results.at(-1)?.value as Promise<PreviewServer>);
    expect(failed.httpServer.listening).toBe(false);
  });
});

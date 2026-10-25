import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { assertFrameDimensions, checkedAsset, ffmpegPath } from "./media.mjs";

/** Serve exact intra-only source frames without expanding an entire 4K edit onto disk. */
export async function serveSourceFrames(out, clips) {
  const token = randomUUID();
  const cache = new Map();
  const pending = new Map();
  const children = new Set();
  let cachedBytes = 0;
  let closed = false;
  // Remotion renders one frame at a time; transitions can request two sources.
  const decode = (id, frame) => {
    const key = `${id}/${frame}`;
    if (cache.has(key)) {
      const data = cache.get(key);
      cache.delete(key);
      cache.set(key, data);
      return Promise.resolve(data);
    }
    if (pending.has(key)) return pending.get(key);
    const clip = clips[id];
    const promise = new Promise((resolve, reject) => {
      const child = spawn(
        ffmpegPath(),
        [
          "-v",
          "error",
          "-threads",
          "1",
          "-ss",
          String(frame / clip.settings.fps),
          "-i",
          checkedAsset(out, `clips/${clip.file}`),
          "-an",
          "-frames:v",
          "1",
          "-c:v",
          "png",
          "-compression_level",
          "1",
          "-threads",
          "1",
          "-f",
          "image2pipe",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      children.add(child);
      const chunks = [];
      let length = 0;
      let diagnostic = "";
      child.stdout.on("data", (chunk) => {
        length += chunk.length;
        if (length > 64 * 1024 * 1024) child.kill();
        else chunks.push(chunk);
      });
      child.stderr.on("data", (chunk) => {
        diagnostic = (diagnostic + chunk).slice(-2000);
      });
      child.once("error", reject);
      child.once("close", (code) => {
        children.delete(child);
        if (closed || code !== 0 || length > 64 * 1024 * 1024)
          return reject(new Error(`Source frame failed: ${id}/${frame}: ${diagnostic}`));
        try {
          const data = Buffer.concat(chunks);
          assertFrameDimensions(data, clip.settings.width, clip.settings.height);
          cache.set(key, data);
          cachedBytes += data.length;
          while (cachedBytes > 64 * 1024 * 1024) {
            const oldest = cache.keys().next().value;
            cachedBytes -= cache.get(oldest).length;
            cache.delete(oldest);
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
  const server = http.createServer(async (request, response) => {
    const match = new RegExp(`^/${token}/([a-z0-9-]+)/([0-9]+)\\.png$`).exec(request.url ?? "");
    const clip = match && clips[match[1]];
    const frame = match && Number(match[2]);
    if (!clip || !Number.isSafeInteger(frame) || frame < 0 || frame >= clip.frameCount) {
      response.writeHead(404).end();
      return;
    }
    try {
      const data = await decode(match[1], frame);
      response
        .writeHead(200, {
          "Content-Type": "image/png",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        })
        .end(data);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/${token}`,
    async close() {
      closed = true;
      for (const child of children) child.kill();
      await Promise.allSettled([...pending.values()]);
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      cache.clear();
    },
  };
}

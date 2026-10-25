import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { assertFrameDimensions, checkedAsset, ffmpegPath } from "./media.mjs";

async function* pngFrames(stream) {
  const iterator = stream[Symbol.asyncIterator]();
  let chunk = Buffer.alloc(0);
  let offset = 0;
  const read = async (length) => {
    const parts = [];
    let remaining = length;
    while (remaining > 0) {
      if (offset === chunk.length) {
        const next = await iterator.next();
        if (next.done) {
          if (remaining === length) return null;
          throw new Error("Truncated source PNG");
        }
        chunk = next.value;
        offset = 0;
      }
      const take = Math.min(remaining, chunk.length - offset);
      parts.push(chunk.subarray(offset, offset + take));
      offset += take;
      remaining -= take;
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts, length);
  };
  while (true) {
    const signature = await read(8);
    if (!signature) return;
    const parts = [signature];
    let length = 8;
    while (true) {
      const header = await read(8);
      if (!header) throw new Error("Truncated source PNG header");
      const size = header.readUInt32BE(0);
      length += size + 12;
      if (length > 64 * 1024 * 1024) throw new Error("Oversized source PNG");
      const payload = await read(size + 4);
      if (!payload) throw new Error("Truncated source PNG payload");
      parts.push(header, payload);
      if (header.toString("ascii", 4, 8) === "IEND") break;
    }
    yield Buffer.concat(parts, length);
  }
}
export async function serveSourceFrames(out, clips) {
  const token = randomUUID(),
    cache = new Map(),
    pending = new Map(),
    decoders = new Map(),
    children = new Set();
  let cachedBytes = 0,
    closed = false;
  const remember = (key, data) => {
    if (cache.has(key)) cachedBytes -= cache.get(key).length;
    cache.set(key, data);
    cachedBytes += data.length;
    while (cachedBytes > 64 * 1024 * 1024) {
      const oldest = cache.keys().next().value;
      cachedBytes -= cache.get(oldest).length;
      cache.delete(oldest);
    }
  };
  function start(id, frame) {
    for (const [key, decoder] of decoders) {
      if (decoders.size < 2) break;
      if (key !== id && !decoder.busy) {
        decoder.child.stdout.destroy();
        decoder.child.kill();
        decoders.delete(key);
      }
    }
    const clip = clips[id],
      child = spawn(
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
          "-c:v",
          "png",
          "-compression_level",
          "0",
          "-pred",
          "none",
          "-threads",
          "1",
          "-f",
          "image2pipe",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    children.add(child);
    child.once("close", () => children.delete(child));
    const decoder = { child, frames: pngFrames(child.stdout), next: frame, busy: false, diagnostic: "", failure: null };
    child.stderr.on("data", (c) => {
      decoder.diagnostic = (decoder.diagnostic + c).slice(-2000);
    });
    child.once("error", (e) => {
      decoder.failure = e;
    });
    decoders.set(id, decoder);
    return decoder;
  }
  async function decode(id, frame) {
    const key = `${id}/${frame}`;
    if (cache.has(key)) {
      const data = cache.get(key);
      cache.delete(key);
      cache.set(key, data);
      return data;
    }
    if (pending.has(key)) return pending.get(key);
    const previous = pending.get(id) ?? Promise.resolve();
    const task = previous
      .catch(() => {})
      .then(async () => {
        if (closed) throw new Error("Frame server closed");
        if (cache.has(key)) return cache.get(key);
        let decoder = decoders.get(id);
        if (!decoder || frame < decoder.next || frame > decoder.next + 12 || decoder.failure) {
          if (decoder) {
            decoder.child.stdout.destroy();
            decoder.child.kill();
          }
          decoder = start(id, frame);
        }
        decoders.delete(id);
        decoders.set(id, decoder);
        decoder.busy = true;
        try {
          while (decoder.next <= frame) {
            const result = await decoder.frames.next();
            if (result.done || decoder.failure)
              throw new Error(`Source decode failed: ${decoder.failure ?? decoder.diagnostic}`);
            assertFrameDimensions(result.value, clips[id].settings.width, clips[id].settings.height);
            const index = decoder.next++;
            remember(`${id}/${index}`, result.value);
            if (index === frame) return result.value;
          }
        } finally {
          decoder.busy = false;
        }
      });
    pending.set(key, task);
    pending.set(id, task);
    void task
      .finally(() => {
        pending.delete(key);
        if (pending.get(id) === task) pending.delete(id);
      })
      .catch(() => {});
    return task;
  }
  const server = http.createServer(async (req, res) => {
    const match = new RegExp(`^/${token}/([a-z0-9-]+)/([0-9]+)\\.png$`).exec(req.url ?? ""),
      clip = match && clips[match[1]],
      frame = match && Number(match[2]);
    if (!clip || !Number.isSafeInteger(frame) || frame < 0 || frame >= clip.frameCount) {
      res.writeHead(404).end();
      return;
    }
    try {
      const data = await decode(match[1], frame);
      res
        .writeHead(200, {
          "Content-Type": "image/png",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        })
        .end(data);
    } catch (e) {
      res.writeHead(500).end(String(e));
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
      const exits = [...children].map(
        (child) =>
          new Promise((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            child.once("close", resolve);
            child.stdout.destroy();
            child.kill();
          }),
      );
      await Promise.allSettled([...pending.values(), ...exits]);
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      cache.clear();
    },
  };
}

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { containedPath } from "./core.mjs";

function parseByteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size)
    return false;
  return { start, end };
}

export async function serveReview(output, report, port = 0) {
  const allowed = new Set([
    "index.html",
    "board.css",
    "board.mjs",
    "playback.mjs",
    "choices.mjs",
    "mappings.json",
    "report.md",
  ]);
  for (const media of Object.values(report.media))
    if (media.available) {
      allowed.add(media.original);
      allowed.add(media.matched);
    }
  const canonicalRoot = await realpath(output);
  const server = createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405);
        response.end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      if (!allowed.has(relative)) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      const file = await realpath(containedPath(output, relative));
      containedPath(canonicalRoot, path.relative(canonicalRoot, file));
      const { size } = await stat(file);
      const range = parseByteRange(request.headers.range, size);
      if (range === false) {
        response.writeHead(416, { "Content-Range": `bytes */${size}` });
        response.end();
        return;
      }
      const mime = {
        ".html": "text/html",
        ".css": "text/css",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".md": "text/plain",
        ".wav": "audio/wav",
      }[path.extname(relative)];
      response.writeHead(range ? 206 : 200, {
        "Content-Type": `${mime}${mime === "audio/wav" ? "" : "; charset=utf-8"}`,
        "Content-Length": range ? range.end - range.start + 1 : size,
        ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` } : {}),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(file, range || undefined);
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

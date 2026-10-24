import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { once } from "node:events";

export function hashFile(file) {
  const hash = createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let length;
    while ((length = fs.readSync(descriptor, buffer)) > 0) hash.update(buffer.subarray(0, length));
    return hash.digest("hex");
  } finally {
    fs.closeSync(descriptor);
  }
}
export function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
export function ffmpegPath() {
  return process.env.ALCHEMY_TRAILER_FFMPEG || "ffmpeg";
}
export function probe(file) {
  const result = spawnSync(
    process.env.ALCHEMY_TRAILER_FFPROBE || "ffprobe",
    ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) throw new Error(`ffprobe failed: ${result.error?.message ?? result.stderr}`);
  return JSON.parse(result.stdout);
}
export function startEncoder(file, { width, height, fps }) {
  const child = spawn(
    ffmpegPath(),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-n",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-vcodec",
      "png",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "0",
      // Every source frame must be independently seekable during editing.
      "-g",
      "1",
      "-pix_fmt",
      "yuv444p",
      "-threads",
      "1",
      "-fps_mode",
      "cfr",
      "-s",
      `${width}x${height}`,
      file,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let diagnostic = "";
  child.stderr.on("data", (chunk) => {
    diagnostic = (diagnostic + chunk).slice(-6000);
  });
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Capture encoder failed (${code}): ${diagnostic}`)),
    );
  });
  // Observe early errors even while frames are being produced.
  void completion.catch(() => {});
  child.stdin.on("error", () => {});
  return {
    async frame(buffer) {
      if (child.exitCode !== null) await completion;
      if (!child.stdin.write(buffer))
        await Promise.race([
          once(child.stdin, "drain"),
          completion.then(() => {
            throw new Error("Encoder ended before capture");
          }),
        ]);
    },
    async finish() {
      child.stdin.end();
      await completion;
    },
    async abort() {
      child.stdin.destroy();
      child.kill("SIGTERM");
      await completion.catch(() => {});
    },
  };
}
export async function runFfmpeg(args) {
  const child = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-n", ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let diagnostic = "";
  child.stderr.on("data", (chunk) => {
    diagnostic = (diagnostic + chunk).slice(-6000);
  });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${diagnostic}`)),
    );
  });
}

export function checkedAsset(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep) || !fs.statSync(file).isFile())
    throw new Error(`Asset outside bundle or missing: ${relative}`);
  return file;
}

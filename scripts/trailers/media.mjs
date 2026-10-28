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
export function probe(file, { countFrames = true, countPackets = false } = {}) {
  const result = spawnSync(
    process.env.ALCHEMY_TRAILER_FFPROBE || "ffprobe",
    [
      "-v",
      "error",
      ...(countFrames ? ["-count_frames"] : []),
      ...(countPackets ? ["-count_packets"] : []),
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) throw new Error(`ffprobe failed: ${result.error?.message ?? result.stderr}`);
  return JSON.parse(result.stdout);
}
export const CAPTURE_ENCODER_POLICY = Object.freeze({
  preset: "veryfast",
  crf: 16,
  maxBitrate: 64_000_000,
  bufferBits: 128_000_000,
  gopSeconds: 2,
  pixelFormat: "yuv444p",
});

/** Every sampled frame must survive encoding, independent of GOP structure. */
export function validateSourceVideo(video, settings, frameCount) {
  if (
    Number(video?.nb_frames) !== frameCount ||
    Number(video?.nb_read_packets) !== frameCount ||
    video.width !== settings.width ||
    video.height !== settings.height ||
    video.codec_name !== "h264" ||
    video.pix_fmt !== "yuv444p" ||
    video.r_frame_rate !== `${settings.fps}/1`
  )
    throw new Error("Capture packet/frame count, dimensions, or frame rate mismatch");
}

/** Reject a wrong-size screenshot before encoding can conceal it by scaling. */
export function assertFrameDimensions(buffer, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(signature) ||
    buffer.readUInt32BE(16) !== width ||
    buffer.readUInt32BE(20) !== height
  )
    throw new Error(`Screenshot must contain native ${width}×${height} PNG pixels`);
}
export function captureEncoderArgs(fps, policy = "lossless") {
  if (policy === "lossless") return ["-preset", "ultrafast", "-crf", "0", "-g", "1"];
  if (policy !== "bounded") throw new Error(`Unknown capture encoder policy: ${policy}`);
  return [
    "-preset",
    CAPTURE_ENCODER_POLICY.preset,
    "-crf",
    String(CAPTURE_ENCODER_POLICY.crf),
    "-maxrate",
    String(CAPTURE_ENCODER_POLICY.maxBitrate),
    "-bufsize",
    String(CAPTURE_ENCODER_POLICY.bufferBits),
    "-g",
    String(fps * CAPTURE_ENCODER_POLICY.gopSeconds),
  ];
}

export function startEncoder(file, { width, height, fps, encoderPolicy = "lossless" }) {
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
      ...captureEncoderArgs(fps, encoderPolicy),
      "-vf",
      `scale=out_color_matrix=bt709:out_range=tv,format=${CAPTURE_ENCODER_POLICY.pixelFormat}`,
      "-x264-params",
      "colorprim=bt709:transfer=bt709:colormatrix=bt709",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-threads",
      "2",
      "-fps_mode",
      "cfr",
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
      assertFrameDimensions(buffer, width, height);
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
  const child = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-xerror", "-n", ...args], {
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

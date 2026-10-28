import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { serveSourceFrames } from "../../scripts/trailers/frame-server.mjs";
import { captureEncoderArgs, ffmpegPath } from "../../scripts/trailers/media.mjs";

const ffmpeg = ffmpegPath();
const available = spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status === 0;

it.skipIf(!available)(
  "returns the exact sequential frames when seeking a bounded GOP",
  async () => {
    const root = mkdtempSync(path.join(tmpdir(), "alchemy-trailer-seek-"));
    const clips = path.join(root, "clips");
    const reference = path.join(root, "reference");
    mkdirSync(clips);
    mkdirSync(reference);
    const video = path.join(clips, "sample.mp4");
    const run = (args: string[]) => {
      const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    };
    try {
      run([
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=64x64:rate=60:duration=3",
        "-an",
        "-c:v",
        "libx264",
        ...captureEncoderArgs(60, "bounded"),
        "-pix_fmt",
        "yuv444p",
        "-threads",
        "1",
        video,
      ]);
      run([
        "-i",
        video,
        "-an",
        "-c:v",
        "png",
        "-compression_level",
        "0",
        "-pred",
        "none",
        "-threads",
        "1",
        path.join(reference, "%03d.png"),
      ]);
      const server = await serveSourceFrames(root, {
        sample: { file: "sample.mp4", frameCount: 180, settings: { width: 64, height: 64, fps: 60 } },
      });
      try {
        for (const frame of [0, 120, 1, 119, 60, 179]) {
          const response = await fetch(`${server.url}/sample/${frame}.png`);
          expect(response.status).toBe(200);
          const expected = readFileSync(path.join(reference, `${String(frame + 1).padStart(3, "0")}.png`));
          expect(Buffer.from(await response.arrayBuffer())).toEqual(expected);
        }
      } finally {
        await server.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  25_000,
);

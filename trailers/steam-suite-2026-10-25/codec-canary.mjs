import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { Buffer } from "node:buffer";
import { log } from "node:console";
import { serveSourceFrames } from "../../scripts/trailers/frame-server.mjs";
import {
  CAPTURE_ENCODER_POLICY,
  startEncoder,
  probe,
  validateSourceVideo,
  hashFile,
} from "../../scripts/trailers/media.mjs";

const project = process.argv[2];
if (!project) throw new Error("Pass the absolute production project directory");
const bundle = path.join(project, "sources/vocal-story-capture-v3");
const source = path.join(bundle, "clips/vocal-story.mp4");
const out = path.join(project, "review/capture-codec-canary-v1");
fs.mkdirSync(out, { recursive: true });
const output = path.join(out, "capture-crf16-interframe-1440p60.mp4");
if (fs.existsSync(output)) throw new Error("Preserve existing canary; choose another version");
const settings = { width: 2560, height: 1440, fps: 60 };
const server = await serveSourceFrames(bundle, { source: { file: "vocal-story.mp4", settings } });
const encoder = startEncoder(output, { ...settings, encoderPolicy: "bounded" });
let complete = false;
try {
  for (let frame = 0; frame < 120; frame++) {
    const response = await globalThis.fetch(`${server.url}/source/${300 + frame}.png`);
    if (!response.ok) throw new Error(await response.text());
    const png = Buffer.from(await response.arrayBuffer());
    if ([0, 60, 119].includes(frame)) fs.writeFileSync(path.join(out, `reference-${frame}.png`), png);
    await encoder.frame(png);
  }
  await encoder.finish();
  complete = true;
} finally {
  if (!complete) await encoder.abort();
  await server.close();
}
const metadata = probe(output, { countFrames: true, countPackets: true });
validateSourceVideo(
  metadata.streams.find((s) => s.codec_type === "video"),
  settings,
  120,
);
const run = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-xerror", "-n", ...args], { encoding: "utf8", maxBuffer: 2 ** 20 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout + r.stderr;
};
for (const frame of [0, 60, 119])
  run([
    "-v",
    "error",
    "-ss",
    String(frame / 60),
    "-i",
    output,
    "-frames:v",
    "1",
    path.join(out, `encoded-${frame}.png`),
  ]);
const metrics = run([
  "-ss",
  "5",
  "-i",
  source,
  "-i",
  output,
  "-filter_complex_threads",
  "1",
  "-filter_complex",
  "[0:v]trim=end_frame=120,setpts=PTS-STARTPTS,split=2[rp][rs];[1:v]split=2[tp][ts];[rp][tp]psnr[p];[rs][ts]ssim[s]",
  "-map",
  "[p]",
  "-map",
  "[s]",
  "-an",
  "-threads",
  "2",
  "-f",
  "null",
  "-",
]);
fs.writeFileSync(path.join(out, "quality-metrics.txt"), metrics);
const old = JSON.parse(fs.readFileSync(path.join(bundle, "clips/vocal-story.json")));
const size = fs.statSync(output).size;
const record = {
  diagnosticOnly: true,
  forTrailerUse: false,
  newGameplayCapture: false,
  source,
  sourceSha256: hashFile(source),
  sourceFrames: [300, 420],
  policy: CAPTURE_ENCODER_POLICY,
  metadata,
  frames: 120,
  duration: 2,
  encodedBytes: size,
  encodedBytesPerSecond: size / 2,
  previousCaptureBytesPerSecond: fs.statSync(source).size / (old.frameCount / 60),
  frameCountAndPacketCountVerified: true,
  ssim: /All:([\d.]+)/u.exec(metrics)?.[1],
  psnr: /average:([\d.]+)/u.exec(metrics)?.[1],
  tradeoff:
    "High-quality lossy source acquisition with full chroma detail. Two-second GOP requires decoding from keyframes; source cadence and accurate edit positions remain unchanged. Original masters untouched.",
  visualReview: "pending native/delivery-size comparison",
  listeningApproval: false,
};
fs.writeFileSync(path.join(out, "technical.json"), JSON.stringify(record, null, 2) + "\n");
log(JSON.stringify({ encodedBytes: size, bytesPerSecond: size / 2, ssim: record.ssim, psnr: record.psnr }, null, 2));

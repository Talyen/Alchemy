import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { compileTimeline, mapSoundEvents, parseRecipe } from "./model.mjs";
import { checkedAsset, hashFile, hashValue, probe, runFfmpeg, writeJson } from "./media.mjs";

const requireTools = createRequire(new URL("./package.json", import.meta.url));
export async function renderRecipe({ root, out, recipe, format = "steam", draft = false, label = "" }) {
  const { bundle } = requireTools("@remotion/bundler");
  const { selectComposition, renderMedia, renderStill } = requireTools("@remotion/renderer");
  const capture = JSON.parse(fs.readFileSync(path.join(out, "capture.json"), "utf8"));
  recipe = parseRecipe(recipe ?? capture.recipe);
  if (capture.draft && !draft)
    throw new Error("Draft source cannot produce a production export; recapture without --draft");
  if (hashValue(recipe.capture) !== hashValue(capture.recipe.capture))
    throw new Error("Capture settings changed; record a new bundle");
  for (const clip of recipe.clips) {
    const recorded = capture.clips[clip.id];
    if (
      !recorded ||
      recorded.recipeHash !== hashValue(clip) ||
      recorded.settings.fps !== recipe.capture.fps ||
      hashFile(checkedAsset(out, `clips/${recorded.file}`)) !== recorded.sha256
    )
      throw new Error(`Capture mismatch for ${clip.id}; recapture changed clips into a fresh bundle`);
  }
  if (
    hashFile(checkedAsset(out, capture.music.file)) !== capture.music.sha256 ||
    recipe.music.boss !== capture.recipe.music.boss
  )
    throw new Error("Soundtrack mismatch; capture this soundtrack into a new bundle");
  const timeline = compileTimeline(recipe, format, draft);
  const duration = timeline.durationInFrames / timeline.fps;
  if (recipe.music.offset + duration > capture.music.duration)
    throw new Error("Edit extends past the soundtrack recording");
  const outputName = `${format}${draft ? "-draft" : ""}${label ? `-${label}` : ""}`;
  const output = path.join(out, `${outputName}.mp4`);
  if (fs.existsSync(output)) throw new Error(`Output exists: ${output}; retain it and choose --label for another edit`);
  fs.mkdirSync(path.join(root, "scratch"), { recursive: true });
  const renderDir = fs.mkdtempSync(path.join(root, "scratch/trailer-render-"));
  const publicDir = path.join(renderDir, "public");
  fs.mkdirSync(publicDir);
  fs.cpSync(path.join(out, "assets"), path.join(publicDir, "assets"), { recursive: true });
  const serveUrl = await bundle({
    entryPoint: path.join(root, "scripts/trailers/renderer/index.jsx"),
    publicDir,
    outDir: path.join(renderDir, "bundle"),
    onProgress: () => {},
  });
  // Decode each master once. Native per-frame video extraction is expensive
  // for 4K 4:4:4 sources; a lossless PNG cache keeps camera composition in the
  // browser without repeated decoder work or a lower-resolution proxy.
  const renderCapture = { ...capture, clips: { ...capture.clips } };
  for (const id of new Set(timeline.shots.map((shot) => shot.clip))) {
    const directory = path.join(serveUrl, "public/frames", id);
    fs.mkdirSync(directory, { recursive: true });
    const ranges = timeline.shots
      .filter((shot) => shot.clip === id)
      .map((shot) => ({
        start: shot.sourceStartFrame,
        end: Math.min(
          capture.clips[id].frameCount - 1,
          Math.floor(shot.sourceStartFrame + (shot.durationInFrames - 1) * shot.speed),
        ),
      }))
      .sort((a, b) => a.start - b.start);
    const merged = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
    }
    for (const range of merged)
      await runFfmpeg([
        "-i",
        checkedAsset(out, `clips/${capture.clips[id].file}`),
        "-an",
        "-vf",
        `select=between(n\\,${range.start}\\,${range.end})`,
        "-frames:v",
        String(range.end - range.start + 1),
        "-c:v",
        "png",
        "-compression_level",
        "1",
        "-threads",
        "1",
        "-fps_mode",
        "passthrough",
        "-start_number",
        String(range.start),
        path.join(directory, "%06d.png"),
      ]);
    const files = fs.readdirSync(directory);
    if (files.length !== merged.reduce((sum, range) => sum + range.end - range.start + 1, 0))
      throw new Error(`Decoded frame count mismatch for ${id}`);
    renderCapture.clips[id] = { ...capture.clips[id], frames: `frames/${id}` };
    console.log(`Prepared ${id}: ${files.length} lossless frames`);
  }
  const inputProps = { timeline, bundle: renderCapture, recipe };
  const browserExecutable = chromium.executablePath();
  const composition = await selectComposition({ serveUrl, id: "AlchemyTrailer", inputProps, browserExecutable });
  const silent = path.join(renderDir, "silent.mp4");
  let reported = -1;
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    browserExecutable,
    outputLocation: silent,
    codec: "h264",
    videoBitrate: "20M",
    pixelFormat: "yuv420p",
    x264Preset: "slow",
    colorSpace: "bt709",
    muted: true,
    concurrency: 1,
    offthreadVideoThreads: 1,
    offthreadVideoCacheSizeInBytes: 128 * 1024 * 1024,
    imageFormat: "png",
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== reported) {
        reported = percent;
        console.log(`Render ${format}: ${percent}%`);
      }
    },
  });
  const sounds = mapSoundEvents(timeline, capture.clips).filter((sound) => sound.duration > 0 && sound.volume > 0);
  const args = [
    "-i",
    silent,
    "-ss",
    String(recipe.music.offset),
    "-t",
    String(duration),
    "-i",
    checkedAsset(out, capture.music.file),
  ];
  const filters = [
    `[1:a]aresample=48000,asetpts=PTS-STARTPTS,volume=${recipe.music.volume},afade=t=in:d=${recipe.music.fadeIn},afade=t=out:st=${Math.max(0, duration - recipe.music.fadeOut)}:d=${recipe.music.fadeOut}[music]`,
  ];
  for (const [index, sound] of sounds.entries()) {
    args.push("-ss", String(sound.offset ?? 0), "-i", checkedAsset(out, sound.file));
    const tempos = sound.speed < 0.5 ? `atempo=0.5,atempo=${sound.speed * 2}` : `atempo=${sound.speed}`;
    filters.push(
      `[${index + 2}:a]aresample=48000,asetpts=PTS-STARTPTS,${tempos},atrim=duration=${sound.duration},volume=${sound.volume},adelay=${Math.round(sound.at * 1000)}:all=1[s${index}]`,
    );
  }
  const labels = ["[music]", ...sounds.map((_, index) => `[s${index}]`)].join("");
  filters.push(
    `${labels}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[audio]`,
  );
  const filterFile = path.join(renderDir, "audio-filter.txt");
  fs.writeFileSync(filterFile, filters.join(";\n"));
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[audio]",
    "-t",
    String(duration),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "320k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-threads",
    "1",
    output,
  );
  await runFfmpeg(args);
  const metadata = probe(output);
  const video = metadata.streams.find((stream) => stream.codec_type === "video");
  const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
  if (
    video?.width !== timeline.width ||
    video?.height !== timeline.height ||
    video?.r_frame_rate !== `${timeline.fps}/1` ||
    Number(video?.nb_read_frames) !== timeline.durationInFrames ||
    video?.codec_name !== "h264" ||
    video?.profile !== "High" ||
    video?.pix_fmt !== "yuv420p" ||
    video?.color_space !== "bt709" ||
    video?.color_primaries !== "bt709" ||
    video?.color_transfer !== "bt709" ||
    audio?.codec_name !== "aac" ||
    audio?.sample_rate !== "48000" ||
    audio?.channels !== 2
  )
    throw new Error("Final export failed technical validation");
  for (const [label, frame] of [
    ["opening", 0],
    ["gameplay", Math.min(timeline.endCardFrom - 1, Math.round(timeline.fps * 5))],
    ["end-card", timeline.endCardFrom + Math.floor((timeline.durationInFrames - timeline.endCardFrom) * 0.7)],
  ]) {
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      browserExecutable,
      output: path.join(out, `${outputName}-${label}.png`),
      frame,
      imageFormat: "png",
    });
  }
  const receipt = {
    version: 1,
    file: path.basename(output),
    sha256: hashFile(output),
    format,
    draft,
    captureDraft: capture.draft,
    recipe,
    timeline,
    source: capture.source,
    soundEvents: sounds.length,
    metadata,
    quality: {
      capture: capture.draft ? "draft" : "production",
      sampling: "offline 60/30 Hz; not a real-time performance measurement",
      targetVideoBitrate: "20M",
      loudnessTargetLUFS: -14,
      truePeakTargetDbTP: -1,
    },
  };
  writeJson(output.replace(/\.mp4$/u, ".json"), receipt);
  fs.rmSync(renderDir, { recursive: true });
  console.log(`Trailer: ${output}`);
  return receipt;
}

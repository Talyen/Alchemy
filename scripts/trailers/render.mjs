import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { serveSourceFrames } from "./frame-server.mjs";
import { compileRenderChunks, compileTimeline, mapSoundEvents, nativeMusicOffsets, parseRecipe } from "./model.mjs";
import { checkedAsset, hashFile, hashValue, probe, runFfmpeg, writeJson } from "./media.mjs";

const requireTools = createRequire(new URL("./package.json", import.meta.url));
export async function renderRecipe({
  root,
  out,
  recipe,
  format = "steam",
  draft = false,
  label = "",
  chunk,
  assemble = false,
}) {
  const { bundle } = requireTools("@remotion/bundler");
  const { selectComposition, renderMedia } = requireTools("@remotion/renderer");
  const capture = JSON.parse(fs.readFileSync(path.join(out, "capture.json"), "utf8"));
  recipe = parseRecipe(recipe ?? capture.recipe);
  if (capture.draft && !draft)
    throw new Error("Draft source cannot produce a production export; recapture without --draft");
  if (hashValue(recipe.capture) !== hashValue(capture.recipe.capture))
    throw new Error("Capture settings changed; record a new bundle");
  const offsets = nativeMusicOffsets(recipe);
  const used = new Set(recipe.shots.map((shot) => shot.clip));
  for (const clip of recipe.clips.filter((clip) => used.has(clip.id))) {
    const recorded = capture.clips[clip.id];
    if (
      !recorded ||
      recorded.recipeHash !== hashValue(clip) ||
      recorded.nativeMusic?.offset !== offsets[clip.id] ||
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
  const silent = path.join(renderDir, "silent.mp4");
  const only = timeline.shots[0];
  const direct =
    timeline.shots.length === 1 &&
    recipe.endCard.duration === 0 &&
    only.speed === 1 &&
    only.transitionFrames === 0 &&
    [only.camera.from, only.camera.to].every((camera) => camera.zoom === 1 && camera.x === 0.5 && camera.y === 0.5) &&
    capture.clips[only.clip].settings.width / capture.clips[only.clip].settings.height ===
      timeline.width / timeline.height;
  if (direct) {
    // A continuous battle needs no compositing. Encode its sampled frames directly,
    // avoiding a second browser and a large temporary PNG cache.
    await runFfmpeg([
      "-ss",
      String(only.in),
      "-i",
      checkedAsset(out, `clips/${capture.clips[only.clip].file}`),
      "-an",
      "-frames:v",
      String(timeline.durationInFrames),
      "-vf",
      `scale=${timeline.width}:${timeline.height}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p`,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-preset",
      "slow",
      "-b:v",
      "20M",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-threads",
      "1",
      silent,
    ]);
  } else {
    const ranges = compileRenderChunks(timeline);
    if (chunk !== undefined && (!Number.isInteger(chunk) || chunk < 1 || chunk > ranges.length))
      throw new Error(`Choose a render chunk from 1 to ${ranges.length}`);
    const editKey = hashValue({
      timeline,
      recipe,
      ranges,
      rendererModule: hashFile(new URL(import.meta.url)),
      clips: [...used].map((id) => [id, capture.clips[id].sha256]),
      renderer: hashFile(path.join(root, "scripts/trailers/renderer/index.jsx")),
      decoder: hashFile(new URL("./frame-server.mjs", import.meta.url)),
      assets: Object.values(capture.assets).map((file) => [file, hashFile(checkedAsset(out, file))]),
      tools: hashFile(path.join(root, "scripts/trailers/package-lock.json")),
    });
    const chunkDir = path.join(out, "edits", `${format}${draft ? "-draft" : ""}-${editKey.slice(0, 16)}`);
    fs.mkdirSync(chunkDir, { recursive: true });
    const chunkFile = (range) => path.join(chunkDir, `${String(range.index).padStart(3, "0")}.mp4`);
    const verified = (range) => {
      const file = chunkFile(range);
      const receipt = `${file}.json`;
      if (!fs.existsSync(file) && !fs.existsSync(receipt)) return false;
      if (!fs.existsSync(file) || !fs.existsSync(receipt)) throw new Error(`Unverified render chunk: ${file}`);
      const prior = JSON.parse(fs.readFileSync(receipt, "utf8"));
      if (
        prior.editKey !== editKey ||
        prior.from !== range.from ||
        prior.to !== range.to ||
        prior.sha256 !== hashFile(file)
      )
        throw new Error(`Render chunk differs from its verified receipt: ${file}`);
      return true;
    };
    const selected = chunk === undefined ? ranges : ranges.filter((range) => range.index === chunk);
    if (!assemble) {
      const missing = selected.filter((range) => !verified(range));
      if (missing.length) {
        const publicDir = path.join(renderDir, "public");
        fs.mkdirSync(publicDir);
        fs.cpSync(path.join(out, "assets"), path.join(publicDir, "assets"), { recursive: true });
        const serveUrl = await bundle({
          entryPoint: path.join(root, "scripts/trailers/renderer/index.jsx"),
          publicDir,
          outDir: path.join(renderDir, "bundle"),
          onProgress: () => {},
        });
        const frames = await serveSourceFrames(out, capture.clips);
        try {
          const renderCapture = {
            ...capture,
            clips: Object.fromEntries(
              Object.entries(capture.clips).map(([id, clip]) => [id, { ...clip, frameUrl: `${frames.url}/${id}` }]),
            ),
          };
          const inputProps = { timeline, bundle: renderCapture, recipe };
          const browserExecutable = chromium.executablePath();
          const composition = await selectComposition({
            serveUrl,
            id: "AlchemyTrailer",
            inputProps,
            browserExecutable,
          });
          for (const range of missing) {
            const partial = path.join(renderDir, `chunk-${range.index}.mp4`);
            let reported = -1;
            await renderMedia({
              composition,
              serveUrl,
              inputProps,
              browserExecutable,
              outputLocation: partial,
              frameRange: [range.from, range.to],
              codec: "h264",
              videoBitrate: "20M",
              pixelFormat: "yuv420p",
              x264Preset: "slow",
              colorSpace: "bt709",
              muted: true,
              concurrency: 1,
              imageFormat: "png",
              onProgress: ({ progress }) => {
                const percent = Math.floor(progress * 10) * 10;
                if (percent !== reported) {
                  reported = percent;
                  console.log(`Render ${format} chunk ${range.index}/${ranges.length}: ${percent}%`);
                }
              },
            });
            const metadata = probe(partial);
            const video = metadata.streams.find((stream) => stream.codec_type === "video");
            if (
              Number(video?.nb_read_frames) !== range.to - range.from + 1 ||
              video.width !== timeline.width ||
              video.height !== timeline.height ||
              video.r_frame_rate !== `${timeline.fps}/1`
            )
              throw new Error(`Rendered chunk frame count or dimensions differ: ${range.index}`);
            const sha256 = hashFile(partial);
            fs.renameSync(partial, chunkFile(range));
            writeJson(`${chunkFile(range)}.json`, { editKey, ...range, sha256, metadata });
          }
        } finally {
          await frames.close();
        }
      }
      if (chunk !== undefined) {
        fs.rmSync(renderDir, { recursive: true });
        console.log(`Render chunk ${chunk}/${ranges.length} complete: ${chunkFile(selected[0])}`);
        return { chunk, chunks: ranges.length, editKey, directory: chunkDir };
      }
    }
    for (const range of ranges)
      if (!verified(range))
        throw new Error(
          `Render chunk ${range.index}/${ranges.length} is missing; capture no new gameplay, render that chunk first`,
        );
    const list = path.join(renderDir, "chunks.ffconcat");
    fs.writeFileSync(
      list,
      ranges.map((range) => `file '${chunkFile(range).replaceAll("'", "'\\''")}'`).join("\n") + "\n",
    );
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-an", "-c:v", "copy", silent]);
  }

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
    "-bsf:v",
    "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1",
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
  const reviewFrames = [
    ["opening", 0],
    ["gameplay", Math.min(timeline.endCardFrom - 1, Math.round(timeline.fps * 5))],
    recipe.endCard.duration > 0
      ? ["end-card", timeline.endCardFrom + Math.floor((timeline.durationInFrames - timeline.endCardFrom) * 0.7)]
      : ["ending", timeline.durationInFrames - 1],
  ];
  for (const [label, frame] of reviewFrames)
    await runFfmpeg([
      "-i",
      output,
      "-vf",
      `select=eq(n\\,${frame})`,
      "-frames:v",
      "1",
      "-threads",
      "1",
      path.join(out, `${outputName}-${label}.png`),
    ]);
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
      composition: direct ? "continuous source encode" : "Remotion composition",
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

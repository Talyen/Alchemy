import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { bossIdleAssets, bossIdleMasters, validateBossIdleRegistry } from "./assets/boss-idle-assets.mjs";
import { resolveAssetSource, requireAssetSources } from "./assets/asset-sources.mjs";
import { ASSET_SCHEMA_VERSION, BOSS_IDLE_SETTINGS, bossIdleTransformSettings } from "./assets/asset-constants.mjs";
import {
  commitManifest,
  loadManifest,
  resolveSourceHash,
  isOutputFresh,
  withOutputHash,
  selectionHash,
} from "./assets/asset-manifest-cache.mjs";
import { ensureOutputDir, resolvePipelinePaths } from "./assets/asset-pipeline-runner.mjs";
import { runPipelineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { mapPool } from "./lib/map-pool.mjs";

const execFileAsync = promisify(execFile);
const { outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, { managedKey: "bossIdles" });

export async function optimizeBossIdles({ check = false, boss } = {}) {
  await validateBossIdleRegistry();
  const masters = boss ? bossIdleMasters.filter((asset) => asset.target.startsWith(`${boss}-idle-`)) : bossIdleMasters;
  if (!masters.length) throw new UsageError(`Unknown animated boss: ${boss}`);
  await requireAssetSources(masters);
  await ensureOutputDir(outputDir, { check });
  const previous = await loadManifest(manifestPath);
  const next = { ...previous };
  let publication = Promise.resolve();
  // Two independent optical-flow jobs fit the host budget. Publish their manifests serially.
  await mapPool(masters, check ? 1 : 2, async (master) => {
    const sourcePath = resolveAssetSource(master.source);
    const variants = bossIdleAssets.filter((asset) => asset.source === master.source);
    const entries = await Promise.all(
      variants.map(async (asset) => {
        const settings = bossIdleTransformSettings(asset);
        const sourceEntry = await resolveSourceHash(sourcePath, settings, ASSET_SCHEMA_VERSION);
        const fresh = await isOutputFresh(path.join(outputDir, asset.target), previous[asset.target], sourceEntry.hash);
        return { asset, settings, sourceEntry, fresh };
      }),
    );
    if (entries.every((entry) => entry.fresh)) return;
    if (check) throw new Error(`Stale prepared boss idle: ${master.target}`);
    if (!ffmpegPath) throw new Error("ffmpeg-static binary not found. Run npm install.");
    // Probe only for regeneration. Ordinary freshness checks need no system FFprobe.
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,duration",
      "-of",
      "json",
      sourcePath,
    ]);
    const video = JSON.parse(stdout).streams[0];
    const duration = Number(video?.duration);
    if (video?.width !== 1920 || video?.height !== 1080 || !Number.isFinite(duration) || duration <= 0)
      throw new Error(`Boss idle master must be finite 1920×1080 video: ${master.source}`);
    const temporary = await mkdtemp(path.join(path.dirname(outputDir), ".boss-idle-prepare-"));
    try {
      const branches = variants.map((_, index) => `[v${index}]`).join("");
      const graph = [
        `[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.125,${BOSS_IDLE_SETTINGS.interpolation},split=${variants.length}${branches}`,
        ...variants.map(
          (asset, index) =>
            `[v${index}]scale=${asset.width}:${(asset.width * 9) / 16}:flags=${BOSS_IDLE_SETTINGS.downsample}[out${index}]`,
        ),
      ].join(";");
      const args = ["-v", "error", "-y", "-filter_complex_threads", "1", "-i", sourcePath, "-filter_complex", graph];
      for (const [index, asset] of variants.entries())
        args.push(
          "-map",
          `[out${index}]`,
          "-an",
          "-t",
          String(duration),
          "-frames:v",
          String(Math.round(duration * BOSS_IDLE_SETTINGS.fps)),
          "-c:v",
          BOSS_IDLE_SETTINGS.codec,
          "-preset",
          BOSS_IDLE_SETTINGS.preset,
          "-crf",
          String(BOSS_IDLE_SETTINGS.crf),
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "2",
          "-movflags",
          "+faststart",
          path.join(temporary, asset.target),
        );
      console.log(`Preparing ${master.target}: 60 fps at ${variants.map((asset) => asset.width).join("/")}px`);
      await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 });
      for (const asset of variants) {
        const { stdout: preparedJson } = await execFileAsync("ffprobe", [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height,codec_name,pix_fmt,avg_frame_rate,nb_frames",
          "-of",
          "json",
          path.join(temporary, asset.target),
        ]);
        const prepared = JSON.parse(preparedJson).streams[0];
        if (
          prepared?.width !== asset.width ||
          prepared?.height !== (asset.width * 9) / 16 ||
          prepared?.codec_name !== "h264" ||
          prepared?.pix_fmt !== "yuv420p" ||
          prepared?.avg_frame_rate !== "60/1" ||
          Number(prepared?.nb_frames) !== Math.round(duration * 60)
        )
          throw new Error(`Incomplete or incorrectly encoded boss idle: ${asset.target}`);
      }
      publication = publication.then(async () => {
        for (const { asset, settings, sourceEntry } of entries) {
          const staged = path.join(temporary, asset.target);
          const entry = await withOutputHash(sourceEntry, staged);
          await rename(staged, path.join(outputDir, asset.target));
          next[asset.target] = { ...entry, selectionHash: selectionHash(asset, settings) };
        }
        // Checkpoint complete masters; partial preparation retains every other clip.
        await commitManifest(manifestPath, next, { outputDir, check: false });
      });
      await publication;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
  const registered = new Set(bossIdleAssets.map((asset) => asset.target));
  const manifest = Object.fromEntries(Object.entries(next).filter(([target]) => registered.has(target)));
  await commitManifest(manifestPath, manifest, { outputDir, check });
  return { ok: true };
}

runPipelineScript(import.meta.url, "Boss idle preparation", () => {
  const { flags, values, rest } = parseKnownFlags(process.argv.slice(2), { check: {}, boss: { takesValue: true } });
  if (rest.length) throw new UsageError(`Unexpected preparation arguments: ${rest.join(", ")}`);
  return optimizeBossIdles({
    check: flags.has("check"),
    ...(values.has("boss") ? { boss: values.get("boss").at(-1) } : {}),
  });
});

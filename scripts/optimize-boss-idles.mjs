import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { bossIdleAssets, validateBossIdleRegistry } from "./assets/boss-idle-assets.mjs";
import { resolveAssetSource, requireAssetSources } from "./assets/asset-sources.mjs";
import { ASSET_SCHEMA_VERSION, BOSS_IDLE_SETTINGS } from "./assets/asset-constants.mjs";
import { processFreshEntry, selectionHash } from "./assets/asset-manifest-cache.mjs";
import {
  ensureOutputDir,
  resolvePipelinePaths,
  runManifestPipeline,
  writeStagedOutput,
} from "./assets/asset-pipeline-runner.mjs";
import { runPipelineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";

const execFileAsync = promisify(execFile);
const { outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, { managedKey: "bossIdles" });

export async function optimizeBossIdles({ check = false } = {}) {
  await validateBossIdleRegistry();
  await requireAssetSources(bossIdleAssets);
  await ensureOutputDir(outputDir, { check });
  return runManifestPipeline({
    entries: bossIdleAssets,
    outputDir,
    manifestPath,
    label: "boss idle",
    concurrency: 1,
    processEntry: async (asset, storedEntry) => {
      const sourcePath = resolveAssetSource(asset.source);
      const outputPath = path.join(outputDir, asset.target);
      const { entry } = await processFreshEntry(
        sourcePath,
        outputPath,
        BOSS_IDLE_SETTINGS,
        ASSET_SCHEMA_VERSION,
        storedEntry,
        () =>
          writeStagedOutput(outputPath, async (temporaryPath) => {
            if (!ffmpegPath) throw new Error("ffmpeg-static binary not found. Run npm install.");
            // Remux without re-encoding: retain every authored video frame and strip the audio track.
            await execFileAsync(ffmpegPath, [
              "-v",
              "error",
              "-y",
              "-i",
              sourcePath,
              "-map",
              "0:v:0",
              "-c:v",
              "copy",
              "-an",
              "-movflags",
              "+faststart",
              temporaryPath,
            ]);
          }),
        { check },
      );
      return { entry: { ...entry, selectionHash: selectionHash(asset, BOSS_IDLE_SETTINGS) } };
    },
    check,
    skipLabel: "boss idle manifest write and orphan sweep",
  });
}

runPipelineScript(import.meta.url, "Boss idle preparation", () => {
  const { flags, rest } = parseKnownFlags(process.argv.slice(2), { check: {} });
  if (rest.length) throw new UsageError(`Unexpected preparation arguments: ${rest.join(", ")}`);
  return optimizeBossIdles({ check: flags.has("check") });
});

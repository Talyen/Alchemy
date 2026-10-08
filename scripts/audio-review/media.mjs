import { resolveAssetSource } from "../assets/asset-library.mjs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { generatedSoundAssets } from "../assets/sound-assets.mjs";
import { containedPath, hashFile } from "./core.mjs";
import { mapPool } from "../lib/map-pool.mjs";

const execute = promisify(execFile);
const PREVIEW_VERSION = 3;
const PREVIEW_SAMPLE_RATE = 48_000;
const PREVIEW_CHANNELS = 2;

function previewDuration(wave) {
  if (wave.toString("ascii", 0, 4) !== "RIFF" || wave.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("Invalid preview WAV");
  // Metadata chunks vary in size; RIFF pads each chunk to an even boundary.
  for (let offset = 12; offset + 8 <= wave.length; ) {
    const size = wave.readUInt32LE(offset + 4);
    if (offset + 8 + size > wave.length) throw new Error("Truncated preview WAV");
    if (wave.toString("ascii", offset, offset + 4) === "data") {
      if (size === 0) throw new Error("Empty preview excerpt");
      return size / (PREVIEW_SAMPLE_RATE * PREVIEW_CHANNELS * 2);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("Preview WAV has no audio data");
}

export async function currentSoundIdentity(root, files) {
  const generated = new Map(generatedSoundAssets.map(({ source, target }) => [target, source]));
  let approved = [];
  try {
    approved = JSON.parse(
      await readFile(path.join(root, "Docs/design/audio-review/approved-choices.json"), "utf8"),
    ).assets;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const approvedByTarget = new Map(approved.map((asset) => [asset.target, asset]));
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => {
        const hashes = [await hashFile(containedPath(path.join(root, "public/sounds"), file))];
        const source = generated.get(file);
        if (source) {
          try {
            hashes.push(await hashFile(resolveAssetSource(source)));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        const selected = approvedByTarget.get(file);
        const approvedExcerpt =
          selected && hashes.includes(selected.sourceSha256)
            ? { assetId: selected.assetId, start: selected.start, duration: selected.duration }
            : undefined;
        return [file, { hashes, rawSource: source ?? null, approvedExcerpt }];
      }),
    ),
  );
}

function comparisonGain(meanDb, peakDb) {
  if (!Number.isFinite(meanDb) || !Number.isFinite(peakDb)) return 0;
  // Fixed gain preserves dynamics; peak cap prevents clipped comparisons.
  return Math.round(Math.min(12, Math.max(-12, -22 - meanDb), -1.5 - peakDb) * 100) / 100;
}

async function encode(args) {
  return execute(ffmpegPath, ["-hide_banner", "-nostdin", ...args], { maxBuffer: 2 * 1024 * 1024, timeout: 120000 });
}

async function preparePreview(source, output, key) {
  const original = `media/${key}-original.wav`;
  const matched = `media/${key}-matched.wav`;
  const cachePath = path.join(output, "media", `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    const originalBytes = await readFile(path.join(output, original));
    // Verify cached bytes as well as source identity; a partial cache must regenerate.
    if (
      cached.originalHash === createHash("sha256").update(originalBytes).digest("hex") &&
      cached.matchedHash === (await hashFile(path.join(output, matched)))
    ) {
      return { ...cached, duration: previewDuration(originalBytes), original, matched };
    }
  } catch (error) {
    if (error.code && error.code !== "ENOENT") throw error;
  }
  const temporaryOriginal = path.join(output, `${original}.partial.wav`);
  const temporaryMatched = path.join(output, `${matched}.partial.wav`);
  try {
    const { stderr } = await encode([
      "-y",
      // Seek before decoding so fades use the excerpt's timestamps.
      // Output seeking would apply the fades to the master before trimming.
      "-ss",
      String(source.start),
      "-i",
      source.sourcePath,
      ...(source.duration ? ["-t", String(source.duration)] : []),
      "-vn",
      "-af",
      source.duration
        ? `afade=t=in:d=0.005,afade=t=out:st=${Math.max(0, source.duration - 0.005)}:d=0.005,volumedetect`
        : "volumedetect",
      "-ar",
      String(PREVIEW_SAMPLE_RATE),
      "-ac",
      String(PREVIEW_CHANNELS),
      "-c:a",
      "pcm_s16le",
      temporaryOriginal,
    ]);
    const meanDb = Number(stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? NaN);
    const peakDb = Number(stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? NaN);
    const gainDb = comparisonGain(meanDb, peakDb);
    await encode(["-y", "-i", temporaryOriginal, "-af", `volume=${gainDb}dB`, "-c:a", "pcm_s16le", temporaryMatched]);
    // Decode both produced files before publishing either preview.
    await encode(["-v", "error", "-i", temporaryOriginal, "-f", "null", "-"]);
    await encode(["-v", "error", "-i", temporaryMatched, "-f", "null", "-"]);
    const originalBytes = await readFile(temporaryOriginal);
    const metadata = {
      duration: previewDuration(originalBytes),
      gainDb,
      meanDb: Number.isFinite(meanDb) ? meanDb : null,
      peakDb: Number.isFinite(peakDb) ? peakDb : null,
      originalHash: createHash("sha256").update(originalBytes).digest("hex"),
      matchedHash: await hashFile(temporaryMatched),
      processing:
        "48 kHz stereo 16-bit PCM preview. Original level has no gain change. Matched level uses fixed gain toward −22 dB mean, capped at −1.5 dB peak and +12 dB boost; dynamics preserved. Excerpts have 5 ms edge fades; they are not final edits or validated loops.",
    };
    await rename(temporaryOriginal, path.join(output, original));
    await rename(temporaryMatched, path.join(output, matched));
    await writeFile(cachePath, `${JSON.stringify(metadata)}\n`);
    return { ...metadata, original, matched };
  } finally {
    await Promise.all(
      [temporaryOriginal, temporaryMatched].map((file) =>
        unlink(file).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        }),
      ),
    );
  }
}

export async function prepareReviewMedia({ root, libraryRoot, output, mappings, checkOnly = false }) {
  const sources = new Map();
  const current = [...new Set(mappings.flatMap((mapping) => mapping.currentFiles))];
  for (const file of current)
    sources.set(`current:${file}`, {
      id: `current:${file}`,
      sourcePath: containedPath(path.join(root, "public/sounds"), file),
      start: 0,
      duration: null,
    });
  for (const mapping of mappings)
    for (const candidate of mapping.candidates) {
      const id = `${candidate.assetId}:${candidate.start}:${candidate.duration}`;
      candidate.mediaId = id;
      sources.set(id, {
        id,
        sourcePath: containedPath(libraryRoot, candidate.path),
        start: candidate.start,
        duration: candidate.duration,
        expectedHash: candidate.storedSha256,
      });
    }
  // Source aliases share one encoding promise as well as one persistent cache key.
  const previews = new Map();
  const media = {};
  const failures = [];
  if (!checkOnly) {
    try {
      await execute(ffmpegPath, ["-version"]);
    } catch {
      throw new Error(
        "ffmpeg-static executable is unavailable. Restore it with: node node_modules/ffmpeg-static/install.js",
      );
    }
    await mkdir(path.join(output, "media"), { recursive: true });
  }
  await mapPool([...sources.values()], 2, async (source) => {
    const item = {
      id: source.id,
      sourcePath: source.sourcePath,
      start: source.start,
      excerptDuration: source.duration,
    };
    try {
      const sourceHash = await hashFile(source.sourcePath);
      if (source.expectedHash && sourceHash !== source.expectedHash)
        throw new Error("Library master no longer matches catalog hash");
      item.sourceHash = sourceHash;
      if (checkOnly) {
        media[source.id] = { ...item, available: true };
        return;
      }
      const key = createHash("sha256")
        .update(JSON.stringify([sourceHash, source.start, source.duration, PREVIEW_VERSION]))
        .digest("hex")
        .slice(0, 24);
      let preview = previews.get(key);
      if (!preview) {
        preview = preparePreview(source, output, key);
        previews.set(key, preview);
      }
      media[source.id] = { ...item, ...(await preview), available: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      media[source.id] = { ...item, available: false, error: message };
      failures.push({ id: source.id, error: message });
    }
  });
  return { media, failures };
}

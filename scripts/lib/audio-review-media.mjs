import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { generatedSoundAssets } from "../assets/sound-assets.mjs";
import { containedPath, hashFile } from "./audio-review.mjs";
import { mapPool } from "./map-pool.mjs";

const execute = promisify(execFile);
const PREVIEW_VERSION = 3;

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
            hashes.push(await hashFile(containedPath(path.join(root, "Raw Assets/Sound Effects"), source)));
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
      const original = `media/${key}-original.wav`;
      const matched = `media/${key}-matched.wav`;
      const cachePath = path.join(output, "media", `${key}.json`);
      try {
        const cached = JSON.parse(await readFile(cachePath, "utf8"));
        // Verify cached bytes as well as source identity; a partial cache must regenerate.
        if (
          cached.originalHash === (await hashFile(path.join(output, original))) &&
          cached.matchedHash === (await hashFile(path.join(output, matched)))
        ) {
          media[source.id] = { ...item, ...cached, available: true, original, matched };
          return;
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
          "48000",
          "-ac",
          "2",
          "-c:a",
          "pcm_s16le",
          temporaryOriginal,
        ]);
        const meanDb = Number(stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? NaN);
        const peakDb = Number(stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? NaN);
        const gainDb = comparisonGain(meanDb, peakDb);
        await encode([
          "-y",
          "-i",
          temporaryOriginal,
          "-af",
          `volume=${gainDb}dB`,
          "-c:a",
          "pcm_s16le",
          temporaryMatched,
        ]);
        // Decode both produced files before publishing either preview.
        await encode(["-v", "error", "-i", temporaryOriginal, "-f", "null", "-"]);
        await encode(["-v", "error", "-i", temporaryMatched, "-f", "null", "-"]);
        const { size } = await stat(temporaryOriginal);
        if (size < 100) throw new Error("Empty preview excerpt");
        const duration = (size - 78) / (48000 * 2 * 2);
        const metadata = {
          duration: Math.max(0, duration),
          gainDb,
          meanDb: Number.isFinite(meanDb) ? meanDb : null,
          peakDb: Number.isFinite(peakDb) ? peakDb : null,
          originalHash: await hashFile(temporaryOriginal),
          matchedHash: await hashFile(temporaryMatched),
          processing:
            "48 kHz stereo 16-bit PCM preview. Original level has no gain change. Matched level uses fixed gain toward −22 dB mean, capped at −1.5 dB peak and +12 dB boost; dynamics preserved. Excerpts have 5 ms edge fades; they are not final edits or validated loops.",
        };
        await rename(temporaryOriginal, path.join(output, original));
        await rename(temporaryMatched, path.join(output, matched));
        await writeFile(cachePath, `${JSON.stringify(metadata)}\n`);
        media[source.id] = { ...item, ...metadata, available: true, original, matched };
      } finally {
        await Promise.all(
          [temporaryOriginal, temporaryMatched].map((file) =>
            unlink(file).catch((error) => {
              if (error.code !== "ENOENT") throw error;
            }),
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      media[source.id] = { ...item, available: false, error: message };
      failures.push({ id: source.id, error: message });
    }
  });
  return { media, failures };
}

import fs from "node:fs";
import path from "node:path";

const IMAGE = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".avif", ".gif", ".ico"]);
const VIDEO = new Set([".mp4", ".webm"]);
const AUDIO = new Set([".mp3", ".ogg", ".wav", ".opus", ".flac", ".m4a"]);

/** Logical file bytes, excluding links; APFS clones/compression can change physical usage. */
export function measureStorage(root) {
  const result = {
    bytes: 0,
    files: 0,
    sourceMaps: 0,
    video: 0,
    music: 0,
    images: 0,
    sounds: 0,
    children: Object.create(null),
  };
  const pending = [""];
  while (pending.length) {
    const relative = pending.pop();
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolute)) pending.push(path.join(relative, entry));
      continue;
    }
    if (!stat.isFile()) continue;
    result.bytes += stat.size;
    result.files += 1;
    const top = relative.split(path.sep)[0] || path.basename(root);
    result.children[top] = (result.children[top] ?? 0) + stat.size;
    const extension = path.extname(relative).toLowerCase();
    if (extension === ".map") result.sourceMaps += stat.size;
    else if (VIDEO.has(extension)) result.video += stat.size;
    else if (IMAGE.has(extension)) result.images += stat.size;
    else if (AUDIO.has(extension)) {
      if (relative.split(path.sep).includes("Music")) result.music += stat.size;
      else result.sounds += stat.size;
    }
  }
  return result;
}

/** Check the whole renderer, including public assets outside Vite's assets/ folder. */
export function checkRendererStorage(root, budgets) {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    console.error(`[storage-budget] FAIL ${root}: renderer index.html is missing`);
    return false;
  }
  const sizes = measureStorage(root);
  const totals = {
    renderer: sizes.bytes - sizes.sourceMaps,
    video: sizes.video,
    music: sizes.music,
    images: sizes.images,
    sounds: sizes.sounds,
  };
  let passed = true;
  for (const [category, bytes] of Object.entries(totals)) {
    const maximum = budgets[category];
    const failed = bytes > maximum;
    const log = failed ? console.error : console.log;
    log(`[storage-budget] ${failed ? "FAIL" : "pass"} ${category} ${bytes} <= ${maximum}`);
    if (failed) passed = false;
    else if (bytes > maximum * 0.95) console.warn(`[storage-budget] WARN ${category} exceeds 95% of its budget`);
  }
  return passed;
}

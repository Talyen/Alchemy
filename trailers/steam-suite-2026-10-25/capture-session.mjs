import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log } from "node:console";
import { captureRecipe } from "../../scripts/trailers/capture.mjs";
import { parseRecipe } from "../../scripts/trailers/model.mjs";
import { captureSourceDigest } from "../../scripts/check.mjs";
import { runGit } from "../../scripts/lib/repository-paths.mjs";
import { hashValue } from "../../scripts/trailers/media.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
const recipeFile = option("--recipe");
const bundle = option("--bundle");
if (!args.includes("--recipe") || !args.includes("--bundle") || !recipeFile || !bundle)
  throw new Error("Use --recipe <file> --bundle <new-directory> [--windows <file>]");
const recipe = parseRecipe(JSON.parse(fs.readFileSync(path.resolve(recipeFile), "utf8")));
const out = path.resolve(bundle);
if (fs.existsSync(out) && fs.readdirSync(out).length)
  throw new Error("Preserve existing captures; choose an empty bundle");
fs.mkdirSync(out, { recursive: true });
const windowsFile = args.includes("--windows") ? option("--windows") : null;
const captureWindows = windowsFile ? JSON.parse(fs.readFileSync(path.resolve(windowsFile), "utf8")) : undefined;
if (captureWindows && (recipe.clips.length !== 1 || !captureWindows[recipe.clips[0].id]))
  throw new Error("This production runner selects windows from one continuous native performance");
const seconds = captureWindows
  ? Object.values(captureWindows)
      .flat()
      .reduce((sum, window) => sum + window.end - window.start, 0)
  : recipe.clips.reduce((sum, clip) => sum + clip.duration, 0);
const stats = fs.statfsSync(out);
const free = stats.bavail * stats.bsize;
const estimate = seconds * (recipe.capture.scale === 2 ? 150 : 50) * 1024 * 1024;
if (free - estimate < 18 * 1024 ** 3)
  throw new Error("Capture budget would leave less than 18 GiB free; reduce bounded windows before recording");
const source = captureSourceDigest({ rootDir: root });
source.commit = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
if (captureWindows) {
  source.performanceRecipeHash = hashValue(recipe);
  source.performanceClipHash = hashValue(recipe.clips[0]);
  fs.writeFileSync(path.join(out, "original-performance.json"), JSON.stringify(recipe, null, 2) + "\n");
  const clip = recipe.clips[0];
  const last = Math.max(...captureWindows[clip.id].map((window) => window.end));
  clip.duration = last;
  clip.actions = clip.actions.filter((action) => action.at < last);
  recipe.shots = [
    { clip: clip.id, in: 0, duration: last, speed: 1, framing: {}, transition: { kind: "cut", duration: 0 } },
  ];
}
await captureRecipe({ root, recipe, out, source, captureWindows, pinVideoStart: true });
log(`Captured: ${out}`);

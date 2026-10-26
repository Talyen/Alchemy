import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log } from "node:console";
import { captureRecipe } from "../../scripts/trailers/capture.mjs";
import { parseRecipe } from "../../scripts/trailers/model.mjs";
import { captureSourceDigest } from "../../scripts/check.mjs";
import { runGit } from "../../scripts/lib/repository-paths.mjs";
import { hashValue, hashFile, CAPTURE_ENCODER_POLICY } from "../../scripts/trailers/media.mjs";

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
const pixels = recipe.capture.viewport.width * recipe.capture.viewport.height * recipe.capture.scale ** 2;
const outputs = captureWindows ? Object.values(captureWindows).flat().length : recipe.clips.length;
// VBV-bound video plus a full buffer, three retained PNG checks per output,
// copied soundtrack/assets and container overhead. No frame dump is produced.
const estimate =
  (seconds * CAPTURE_ENCODER_POLICY.maxBitrate) / 8 +
  outputs * (CAPTURE_ENCODER_POLICY.bufferBits / 8 + 3 * pixels * 4.1 + 24 * 1024 ** 2);
if (free - estimate < 18 * 1024 ** 3)
  throw new Error("Capture budget would leave less than 18 GiB free; reduce bounded windows before recording");
const source = captureSourceDigest({ rootDir: root });
const foregroundLyrics = args.includes("--foreground-lyrics");
source.presentation = { foregroundNativeLyrics: foregroundLyrics };
source.captureEncoder = CAPTURE_ENCODER_POLICY;
source.storageBudget = { estimatedBytes: Math.ceil(estimate), freeBytes: free, reserveBytes: 18 * 1024 ** 3 };
source.commit = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
const motionFile = path.join(root, "src/lib/game-constants/ui-motion.ts");
const actorFile = path.join(root, "src/features/alchemy/run-loop/battle/presentation/ui/actor-panel.tsx");
const flightRuleFile = path.join(root, "src/lib/battle/card-animation-target.ts");
const cardPlayFile = path.join(root, "src/features/alchemy/run-loop/battle/battle-card-play.ts");
source.visualFixes = {
  combatTextBaseSize: Number(/COMBAT_TEXT_BASE_SIZE_PX = ([\d.]+)/u.exec(fs.readFileSync(motionFile, "utf8"))?.[1]),
  earthElementalBattleMirroring: fs.readFileSync(actorFile, "utf8").includes('currentEnemy?.id === "earth-elemental"'),
  motionSourceSha256: hashFile(motionFile),
  actorSourceSha256: hashFile(actorFile),
  dominantDirectFlightRecipient:
    fs.existsSync(flightRuleFile) &&
    fs.readFileSync(cardPlayFile, "utf8").includes("getBattleCardAnimationTarget(handCard, currentState)"),
  flightRuleSourceSha256: fs.existsSync(flightRuleFile) ? hashFile(flightRuleFile) : null,
};
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
await captureRecipe({ root, recipe, out, source, captureWindows, pinVideoStart: true, foregroundLyrics });
log(`Captured: ${out}`);

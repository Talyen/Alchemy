import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { runGit } from "./lib/repository-paths.mjs";
import { captureSourceDigest } from "./check.mjs";
import { parseRecipe, compileTimeline, OUTPUTS } from "./trailers/model.mjs";
import { captureRecipe } from "./trailers/capture.mjs";
import { renderRecipe } from "./trailers/render.mjs";
import { ffmpegPath, probe, writeJson } from "./trailers/media.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const requireTools = createRequire(new URL("./trailers/package.json", import.meta.url));

function parseArgs(argv) {
  const [command = "help", ...args] = argv;
  if (!["help", "setup", "doctor", "plan", "capture", "render", "make", "inspect"].includes(command))
    throw new UsageError(`Unknown trailer command: ${command}`);
  const options = { command, format: "steam", draft: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--draft") options.draft = true;
    else if (
      ["--recipe", "--bundle", "--format", "--label"].includes(arg) &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      options[arg.slice(2)] = args[++index];
    else throw new UsageError(`Unknown or incomplete trailer option: ${arg}`);
  }
  if (!OUTPUTS[options.format]) throw new UsageError("--format must be steam, vertical, or square");
  if (options.label && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options.label))
    throw new UsageError("--label must be lowercase words separated by hyphens");
  if (["render", "inspect"].includes(command) && !options.bundle) throw new UsageError(`${command} needs --bundle`);
  return options;
}

function doctor() {
  for (const binary of [ffmpegPath(), process.env.ALCHEMY_TRAILER_FFPROBE || "ffprobe"]) {
    const result = spawnSync(binary, ["-version"], { encoding: "utf8" });
    if (result.error || result.status !== 0)
      throw new Error(
        `Missing ${binary}. Install FFmpeg (with libx264 and AAC) and ffprobe, or set ALCHEMY_TRAILER_FFMPEG / ALCHEMY_TRAILER_FFPROBE.`,
      );
    console.log(result.stdout.split("\n")[0]);
  }
  try {
    requireTools.resolve("@remotion/renderer");
  } catch {
    throw new Error("Run npm run trailer -- setup to install the isolated rendering tools");
  }
  console.log("Remotion tools installed. Capture uses isolated Chromium; no player save or desktop profile is opened.");
}

export async function runTrailer(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    console.log(`Alchemy automated trailers
  npm run trailer -- setup
  npm run trailer -- doctor
  npm run trailer -- plan [--recipe trailers/boss-spotlight.json] [--format steam|vertical|square]
  npm run trailer -- make [--recipe <file>] [--bundle <new-directory>] [--draft] [--format steam|vertical|square]
  npm run trailer -- capture [--recipe <file>] [--bundle <new-directory>] [--draft]
  npm run trailer -- render --bundle <directory> [--recipe <edited-file>] [--format steam|vertical|square] [--draft] [--label <edit-name>]
  npm run trailer -- inspect --bundle <directory>
Production captures default to 3840×2160 at 60 offline samples/s. --draft captures 1920×1080 and renders half-size; fps and timing stay unchanged.
Existing clips and exports are preserved. To revise an edit, use render with --label. Changed capture instructions or native lyric timing require a fresh capture bundle.
Capture/render are intentional media-production jobs. On the shared Mac, wrap make/capture/render with the host heavy_lane.py helper; see Docs/TRAILERS.md.`);
    return;
  }
  if (options.command === "setup") {
    const result = spawnSync(
      "npm",
      ["ci", "--prefix", path.join(ROOT, "scripts/trailers"), "--ignore-scripts", "--no-audit", "--no-fund"],
      { stdio: "inherit" },
    );
    if (result.error || result.status !== 0)
      throw new Error(`Trailer dependency setup failed: ${result.error?.message ?? result.status}`);
    return;
  }
  if (options.command === "doctor") {
    doctor();
    return;
  }
  const out = options.bundle ? path.resolve(options.bundle) : null;
  if (options.command === "inspect") {
    const capture = JSON.parse(fs.readFileSync(path.join(out, "capture.json"), "utf8"));
    console.log(
      JSON.stringify(
        {
          source: capture.source,
          clips: Object.values(capture.clips).map((clip) => ({
            id: clip.id,
            settings: clip.settings,
            frameCount: clip.frameCount,
            actions: clip.actions.length,
            soundEvents: clip.sounds.length,
          })),
          exports: fs
            .readdirSync(out)
            .filter((name) => name.endsWith(".mp4"))
            .map((file) => ({ file, metadata: probe(path.join(out, file)) })),
        },
        null,
        2,
      ),
    );
    return;
  }
  const recipeFile = options.recipe
    ? path.resolve(options.recipe)
    : options.command === "render"
      ? null
      : path.join(ROOT, "trailers/boss-spotlight.json");
  const recipe = recipeFile ? parseRecipe(JSON.parse(fs.readFileSync(recipeFile, "utf8"))) : null;
  if (options.command === "plan") {
    console.log(JSON.stringify({ recipe, timeline: compileTimeline(recipe, options.format, options.draft) }, null, 2));
    return;
  }
  doctor();
  const destination =
    out ?? path.join(ROOT, "output/trailers", recipe.id, new Date().toISOString().replaceAll(/[:.]/gu, "-"));
  if (["capture", "make"].includes(options.command)) {
    if (fs.existsSync(destination) && fs.readdirSync(destination).length)
      throw new Error(`Bundle directory must be empty: ${destination}`);
    fs.mkdirSync(destination, { recursive: true });
    writeJson(path.join(destination, "recipe.json"), recipe);
    const source = captureSourceDigest({ rootDir: ROOT });
    source.commit = runGit(ROOT, ["rev-parse", "HEAD"]).stdout.trim();
    await captureRecipe({ root: ROOT, recipe, out: destination, draft: options.draft, source });
  }
  if (["render", "make"].includes(options.command))
    await renderRecipe({
      root: ROOT,
      out: destination,
      recipe,
      format: options.format,
      draft: options.draft,
      label: options.label,
    });
  console.log(`Bundle: ${destination}`);
}

// Production media must never be expired by the diagnostic artifact pruner.
defineScript(import.meta.url, () => runTrailer());

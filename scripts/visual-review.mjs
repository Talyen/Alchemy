#!/usr/bin/env node
/** Local visual evidence gate. Human observations remain attestations, never aesthetic scores. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { listRepositoryFiles, toRepoRelative } from "./lib/repository-paths.mjs";
import { parseChangedPathsArgs, resolveSelectedPaths } from "./lib/verification/changed-paths.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const RECEIPT = "reports/visual-review/review.json";

export function requiresVisualReview(file) {
  return (
    (/^src\//u.test(file) && !/\.mdx?$/iu.test(file)) ||
    file === "index.html" ||
    /^public\/.*\.(png|jpe?g|webp|svg|gif|woff2?)$/iu.test(file) ||
    /^scripts\/assets\/(core|content|card|talent|gear|icon)-assets\.mjs$/u.test(file)
  );
}

/** Content identity survives commits but invalidates evidence after runtime or dependency changes. */
export function visualSourceDigest(root) {
  const hash = createHash("sha256");
  for (const file of listRepositoryFiles(root).filter(
    (file) => requiresVisualReview(file) || /^(package(-lock)?\.json|vite\.config\.ts|game-edition\.mjs)$/u.test(file),
  )) {
    const absolute = path.join(root, file);
    try {
      const bytes = fs.readFileSync(absolute);
      hash.update(file).update("\0").update(bytes);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      continue; // A deleted file stays absent both before and after committing.
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${label}`);
}
function entries(value, label) {
  if (!Array.isArray(value) || !value.length) throw new Error(`Missing ${label}`);
  return value;
}

export async function validateVisualReview(root, paths, receipt) {
  const required = paths.filter(requiresVisualReview);
  if (!required.length) return;
  if (receipt.version !== 1 || receipt.source !== visualSourceDigest(root))
    throw new Error("Visual review is missing or stale for the current runtime source");
  const covered = entries(receipt.paths, "reviewed paths").map((file) => toRepoRelative(root, file));
  for (const file of required) if (!covered.includes(file)) throw new Error(`Visual review does not cover ${file}`);
  if (receipt.kind === "waived") {
    text(receipt.reason, "explicit user waiver and unverified scope");
    return;
  }
  if (receipt.kind === "nonvisual") {
    text(receipt.reason, "specific reason the selected changes cannot alter presentation or interaction");
    return;
  }
  if (receipt.kind !== "visual") throw new Error("Review kind must be visual, nonvisual or explicitly waived");
  text(receipt.task, "player decision and necessary information");
  for (const reference of entries(receipt.references, "visual references"))
    text(reference, "reference and borrowed qualities");
  for (const field of ["appearance", "copy", "interaction", "artwork"])
    text(receipt[field], `${field} findings, fixes and remaining limitations`);
  if (receipt.acceptance !== "passed") throw new Error("Visual acceptance remains pending; do not integrate");
  if (receipt.majorRedesign === true) {
    if (entries(receipt.alternatives, "two composition alternatives").length < 2)
      throw new Error("Major redesigns require two composition alternatives");
    for (const alternative of receipt.alternatives) {
      text(alternative, "rendered alternative image path");
      const absolute = path.resolve(root, toRepoRelative(root, alternative));
      if (!["png", "jpeg", "webp"].includes((await sharp(absolute).metadata()).format))
        throw new Error("Composition alternatives must be raster captures");
      await sharp(absolute).resize(1, 1).raw().toBuffer();
    }
    if (
      new Set(
        receipt.alternatives.map((file) =>
          createHash("sha256")
            .update(fs.readFileSync(path.resolve(root, file)))
            .digest("hex"),
        ),
      ).size < 2
    )
      throw new Error("Composition alternatives must be distinct captures");
    text(receipt.selection, "composition selection and who selected it");
  } else if (receipt.majorRedesign !== false) throw new Error("Declare majorRedesign as true or false");
  for (const comparison of entries(receipt.comparisons, "before/after screenshot comparisons")) {
    text(comparison.state, "reproducible route, game state, locale and capture conditions");
    const [width, height] = comparison.viewport ?? [];
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
      throw new Error("Comparison viewport must be [width, height]");
    if (width !== 1920 || height !== 1080) text(comparison.viewportReason, "reason for nondefault viewport");
    for (const phase of ["before", "after"]) {
      const relative = toRepoRelative(root, comparison[phase]);
      const absolute = path.resolve(root, relative);
      if (!fs.statSync(absolute).isFile()) throw new Error(`Missing ${phase} screenshot`);
      const metadata = await sharp(absolute).metadata();
      if (!["png", "jpeg", "webp"].includes(metadata.format) || metadata.width !== width || metadata.height !== height)
        throw new Error(`${phase} screenshot must be a raster image matching its comparison viewport`);
      await sharp(absolute).resize(1, 1).raw().toBuffer(); // Decode pixels, not just a plausible header.
    }
    if (comparison.before === comparison.after) throw new Error("Before and after need separate capture paths");
    if (
      fs
        .readFileSync(path.resolve(root, comparison.before))
        .equals(fs.readFileSync(path.resolve(root, comparison.after)))
    )
      text(
        comparison.unchangedAppearanceReason,
        "reason unchanged screenshot pixels still exercise the affected interaction",
      );
  }
}

export async function runVisualReview(argv, root = ROOT) {
  const init = argv.includes("--init");
  const { flags, paths } = parseChangedPathsArgs(argv.filter((arg) => arg !== "--init"));
  for (const flag of flags) if (flag !== "diff") throw new Error(`Unknown visual-review option: --${flag}`);
  const selected = resolveSelectedPaths(root, { flags, paths });
  const required = selected.filter(requiresVisualReview);
  if (!required.length) {
    console.log("Visual review: no presentation/runtime paths selected.");
    return;
  }
  const file = path.join(root, RECEIPT);
  if (init) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          version: 1,
          source: visualSourceDigest(root),
          paths: required,
          kind: "visual",
          acceptance: "pending",
          task: "",
          references: [],
          majorRedesign: false,
          comparisons: [{ state: "", viewport: [1920, 1080], before: "", after: "" }],
          appearance: "",
          copy: "",
          interaction: "",
          artwork: "",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.log(`Fill ${RECEIPT}; see Docs/UI_VISUAL_REVIEW.md. Existing evidence is never overwritten.`);
    return;
  }
  if (!fs.existsSync(file))
    throw new Error(`Missing ${RECEIPT}. Run npm run visual:review -- --init <paths>; see Docs/UI_VISUAL_REVIEW.md`);
  await validateVisualReview(root, required, JSON.parse(fs.readFileSync(file, "utf8")));
  console.log("Visual review: current evidence and scope checked; aesthetic findings are reviewer attestations.");
}

if (isMainModule(import.meta.url)) {
  runVisualReview(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

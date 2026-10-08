import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import {
  buildMappings,
  collectAudioEvidence,
  inspectLibrary,
  loadGameInventory,
  readLibraryCatalog,
} from "./audio-review/core.mjs";
import { currentSoundIdentity, prepareReviewMedia } from "./audio-review/media.mjs";
import { serveReview } from "./audio-review/server.mjs";
import { importChoices, restoreChoices } from "./audio-review/choices.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const reviewOutput = (battleFocus) => path.join(root, "reports/audio-review", battleFocus ? "battle-focus" : "");

function reportMarkdown(report) {
  const lines = [
    "# Alchemy sound proposal",
    "",
    `Direction: ${report.direction}. ${report.mappings.length} mappings, ${report.inventory.cards.length} cards, ${report.inventory.enemies.length} enemies, ${report.inventory.companions.length} companions, ${report.inventory.screens.length} screens.`,
    "",
    "All proposals are metadata-based and unheard. Playback verification proves decoding, not subjective suitability. Gameplay and library masters are unchanged.",
    "",
    "## Review first",
    "",
    ...report.mappings
      .filter((mapping) => mapping.priority === "P1")
      .map((mapping) => `- **${mapping.title}** (${mapping.status}): ${mapping.rationale}`),
    "",
    "## Coverage and current behavior",
    "",
    "Enemy ability turns use card cues before fallback attacks. Registered-unused cues do not currently play. Gain/transaction/impact layers must be reviewed together to avoid doubled feedback. Optional ambience is lower priority; loop seams are unverified.",
    "",
    `Catalog entries: ${report.catalogCount}; stale paths: ${report.missingCatalogPaths.length}; preview failures: ${report.failures.length}.`,
    "",
    ...report.missingCatalogPaths.map((file) => `- Stale catalog path: ${file}`),
    "",
    "## Full mappings",
    "",
  ];
  for (const mapping of report.mappings) {
    lines.push(
      `### ${mapping.title} · ${mapping.id}`,
      "",
      `${mapping.group} / ${mapping.familyTitle} / ${mapping.status} / ${mapping.currentState}.`,
      "",
      `Trigger: ${mapping.trigger}`,
      "",
      `Current: ${mapping.currentFiles.join(", ") || "Silent"}.`,
      "",
      mapping.rationale,
      "",
      mapping.note,
      "",
    );
    for (const [i, candidate] of mapping.candidates.entries())
      lines.push(
        `- ${i ? "Alternative" : "Recommended"}: \`${candidate.assetId}\` — ${candidate.originalName}`,
        `  - Source: ${candidate.path}`,
        `  - Pack: ${candidate.source}; provenance: ${candidate.licenseReference}`,
        `  - Excerpt: ${candidate.start}s + ${candidate.duration}s. ${candidate.note}${candidate.identicalTo.length ? ` Same recording as ${candidate.identicalTo.join(", ")}; not a new replacement.` : ""}`,
      );
    if (mapping.silenceReason) lines.push(`Silence: ${mapping.silenceReason}`, "");
    lines.push(`Evidence: ${mapping.evidence.join(", ")}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export async function generateAudioReview({ libraryRoot, checkOnly = false, choicesPath, battleFocus = false } = {}) {
  const output = reviewOutput(battleFocus);
  const manifest = JSON.parse(await readFile(path.join(root, "Docs/design/audio-review/mappings.json"), "utf8"));
  libraryRoot = path.resolve(libraryRoot ?? manifest.libraryRootDefault);
  const { catalog, metadataSource } = await readLibraryCatalog(
    libraryRoot,
    manifest.families.flatMap((family) => family.candidates),
  );
  const inventory = await loadGameInventory();
  const files = [
    ...new Set(
      Object.values(inventory.registry)
        .flatMap((table) => Object.values(table).flat())
        .filter((file) => typeof file === "string"),
    ),
  ];
  const identities = await currentSoundIdentity(root, files);
  const allMappings = buildMappings(manifest, inventory, catalog, identities);
  const mappings = battleFocus
    ? manifest.battleFocus.map((id) => {
        const mapping = allMappings.find((entry) => entry.id === id);
        if (!mapping || mapping.candidates.length < 2 || mapping.candidates.length > 4)
          throw new Error(`Invalid battle audition: ${id}`);
        return mapping;
      })
    : allMappings;
  let initialChoices = {};
  const choicesCache = path.join(output, "imported-choices.json");
  try {
    initialChoices = restoreChoices(mappings, JSON.parse(await readFile(choicesCache, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (choicesPath) {
    const imported = importChoices(JSON.parse(await readFile(path.resolve(choicesPath), "utf8")), mappings);
    if (imported.skipped)
      throw new Error(`Choices import has ${imported.skipped} unknown mappings or stale candidates; no import saved.`);
    initialChoices = { ...initialChoices, ...imported.choices };
    console.info(`Imported ${Object.keys(imported.choices).length} review records from ${choicesPath}.`);
  }
  const missingCatalogPaths = await inspectLibrary(catalog, libraryRoot);
  const { media, failures } = await prepareReviewMedia({ root, libraryRoot, output, mappings, checkOnly });
  const report = {
    schemaVersion: 1,
    reviewId: battleFocus ? "battle-focus-v1" : undefined,
    metadataSource,
    direction: manifest.direction,
    generatedAt: new Date().toISOString(),
    libraryRoot,
    catalogCount: catalog.length,
    missingCatalogPaths,
    inventory,
    mappings,
    sequences: battleFocus ? [] : manifest.sequences,
    media,
    failures,
    evidence: await collectAudioEvidence(root),
    initialChoices,
  };
  if (!checkOnly) {
    await mkdir(output, { recursive: true });
    for (const [source, target] of [
      ["board.html", "index.html"],
      ["board.css", "board.css"],
      ["board.mjs", "board.mjs"],
      ["playback.mjs", "playback.mjs"],
      ["choices.mjs", "choices.mjs"],
    ])
      await copyFile(path.join(root, "scripts/audio-review", source), path.join(output, target));
    await writeFile(path.join(output, "mappings.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.join(output, "report.md"), reportMarkdown(report));
    if (choicesPath) await writeFile(choicesCache, `${JSON.stringify(initialChoices, null, 2)}\n`);
  }
  console.info(
    `${checkOnly ? "Validated" : "Prepared"} ${mappings.length} mappings; ${Object.keys(media).length} previews; ${missingCatalogPaths.length} stale catalog paths; ${failures.length} preview failures.`,
  );
  if (failures.length)
    throw new Error(`Review has unavailable media: ${failures.map(({ id, error }) => `${id}: ${error}`).join("; ")}`);
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let libraryRoot,
    choicesPath,
    port = 4317,
    serve = false,
    checkOnly = false,
    serveOnly = false,
    battleFocus = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--serve") serve = true;
    else if (args[i] === "--serve-only") {
      serve = true;
      serveOnly = true;
    } else if (args[i] === "--battle-focus") battleFocus = true;
    else if (args[i] === "--check") checkOnly = true;
    else if (args[i] === "--library" && args[i + 1]) libraryRoot = args[++i];
    else if (args[i] === "--choices" && args[i + 1]) choicesPath = args[++i];
    else if (args[i] === "--port" && args[i + 1]) port = Number(args[++i]);
    else
      throw new UsageError(
        "Usage: npm run audio:review -- [--check | --serve | --serve-only] [--battle-focus] [--library <Sounds directory>] [--choices <export.json>] [--port <port>]",
      );
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (checkOnly && serve))
    throw new UsageError("Invalid port or incompatible review modes");
  if (serveOnly && choicesPath) throw new UsageError("Use --serve with --choices to regenerate and import choices");
  const report = serveOnly
    ? JSON.parse(await readFile(path.join(reviewOutput(battleFocus), "mappings.json"), "utf8"))
    : await generateAudioReview({ libraryRoot, checkOnly, choicesPath, battleFocus });
  if (!serve) return;
  const server = await serveReview(reviewOutput(battleFocus), report, port);
  console.info(`Alchemy audio review: http://127.0.0.1:${server.address().port}/ (Ctrl+C to stop)`);
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

defineScript(import.meta.url, main, { artifacts: true });

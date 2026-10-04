import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { withReportServer } from "./vite-report-server.mjs";

// The library catalog uses quoted commas, escaped quotes and multiline fields.
export function parseCatalog(csv) {
  const records = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length) throw new Error("Unexpected catalog quote");
      else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\n")) {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (ch === "\n") {
        if (row.some(Boolean)) records.push(row);
        row = [];
      }
    } else field += ch;
  }
  if (quoted) throw new Error("Unterminated catalog field");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    records.push(row);
  }
  const [headers, ...values] = records;
  if (!headers?.includes("asset_id") || !headers.includes("path")) throw new Error("Invalid library catalog headers");
  return values.map((value) => {
    if (value.length !== headers.length) throw new Error("Invalid library catalog column count");
    return Object.fromEntries(headers.map((header, i) => [header, value[i]]));
  });
}

export function containedPath(root, relative) {
  const resolved = path.resolve(root, relative);
  const difference = path.relative(root, resolved);
  if (!difference || difference.startsWith(`..${path.sep}`) || difference === ".." || path.isAbsolute(difference))
    throw new Error(`Path escapes its owner: ${relative}`);
  return resolved;
}

export async function hashFile(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

/** A relocated library can retain the masters without its optional catalog. */
export async function readLibraryCatalog(libraryRoot, candidates) {
  try {
    return {
      catalog: parseCatalog(await readFile(path.join(libraryRoot, "reference/catalog.csv"), "utf8")),
      metadataSource: "catalog",
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const selected = new Map();
  for (const candidate of candidates) {
    const previous = selected.get(candidate.assetId);
    if (previous && previous.path !== candidate.path)
      throw new Error(`Conflicting candidate paths: ${candidate.assetId}`);
    selected.set(candidate.assetId, candidate);
  }
  const catalog = await Promise.all(
    [...selected.values()].map(async (candidate) => {
      const file = containedPath(libraryRoot, candidate.path);
      const [originalName, pack, filenameId] = path.basename(file, path.extname(file)).split("__");
      if (filenameId !== candidate.assetId || !pack)
        throw new Error(`Candidate filename identity mismatch: ${candidate.path}`);
      return {
        asset_id: candidate.assetId,
        path: candidate.path,
        stored_sha256: await hashFile(file),
        original_sha256: "",
        original_names: originalName.replaceAll("_", " "),
        source_libraries: pack.replaceAll("_", " "),
        license_reference: "Catalog unavailable; attribution inferred from filename only.",
        duration_seconds: "",
        review_required: "True",
        provenance_ids: "",
      };
    }),
  );
  return { catalog, metadataSource: "filenames-and-file-hashes" };
}

export async function loadGameInventory() {
  return withReportServer(async (server) => {
    const load = (file) => server.ssrLoadModule(`/src/${file}.ts`);
    const { cardLibrary } = await load("lib/game-data/cards");
    const { getCardKeywords, keywordDefinitions } = await load("lib/game-data/keywords");
    const { enemyBestiary } = await load("lib/game-data/compendium/enemies");
    const { companionLibrary } = await load("lib/game-data/companions");
    const { ROUTE_SCREEN_VALUES } = await load("lib/routing/screens");
    const { DESTINATIONS } = await load("lib/routing/destinations");
    const registry = await load("lib/audio/sound-registry");
    return {
      cards: cardLibrary.map((card) => ({ id: card.id, title: card.title, keywords: getCardKeywords(card) })),
      enemies: enemyBestiary.map(({ id, title, enemyType, abilityIds }) => ({ id, title, enemyType, abilityIds })),
      companions: Object.values(companionLibrary).map(({ id, title }) => ({ id, title })),
      screens: ROUTE_SCREEN_VALUES,
      destinations: Object.values(DESTINATIONS),
      keywords: Object.keys(keywordDefinitions),
      registry: Object.fromEntries(
        [
          "cardSounds",
          "enemyAttackSounds",
          "battleEventSounds",
          "uiSounds",
          "stingerSounds",
          "screenAmbienceSounds",
        ].map((key) => [key, registry[key]]),
      ),
    };
  });
}

function assertCoverage(expected, assigned, label) {
  const wanted = new Set(expected);
  const actual = new Set(assigned);
  const missing = [...wanted].filter((id) => !actual.has(id));
  const stale = [...actual].filter((id) => !wanted.has(id));
  if (missing.length || stale.length)
    throw new Error(`${label} coverage: missing [${missing.join(", ")}]; stale [${stale.join(", ")}]`);
}

export function validateMappings(manifest, inventory, catalog) {
  const ids = new Set();
  const families = new Set(manifest.families.map((family) => family.id));
  if (families.size !== manifest.families.length) throw new Error("Duplicate sound family");
  const assets = new Map(catalog.map((asset) => [asset.asset_id, asset]));
  if (assets.size !== catalog.length) throw new Error("Duplicate catalog asset ID");
  for (const family of manifest.families) {
    if (family.candidates.length > 4) throw new Error(`Too many alternatives for ${family.id}`);
    const chosen = new Set();
    for (const candidate of family.candidates) {
      const asset = assets.get(candidate.assetId);
      if (!asset || asset.path !== candidate.path)
        throw new Error(`Missing or relocated candidate: ${candidate.assetId}`);
      if (chosen.has(candidate.assetId)) throw new Error(`Duplicate candidate for ${family.id}`);
      chosen.add(candidate.assetId);
      if (
        !Number.isFinite(candidate.start) ||
        candidate.start < 0 ||
        !Number.isFinite(candidate.duration) ||
        candidate.duration <= 0
      )
        throw new Error(`Invalid preview excerpt for ${candidate.assetId}`);
    }
  }
  for (const entry of manifest.actions) {
    if (ids.has(entry.id)) throw new Error(`Duplicate action: ${entry.id}`);
    ids.add(entry.id);
    if (!families.has(entry.family)) throw new Error(`Unknown family: ${entry.family}`);
    if (!["playing", "registered-unused", "silent"].includes(entry.currentState))
      throw new Error(`Invalid current state: ${entry.id}`);
    if (!entry.evidence?.length) throw new Error(`Missing action evidence: ${entry.id}`);
    if (entry.current) {
      const [table, key] = entry.current.split(".");
      if (!Object.hasOwn(inventory.registry[table] ?? {}, key)) throw new Error(`Stale current cue: ${entry.current}`);
    } else if (entry.currentState !== "silent") throw new Error(`Current state requires a registration: ${entry.id}`);
  }
  for (const kind of ["cards", "enemies", "companions"]) {
    assertCoverage(
      inventory[kind].map(({ id }) => id),
      Object.keys(manifest.assignments[kind]),
      kind,
    );
    for (const family of Object.values(manifest.assignments[kind]))
      if (!families.has(family)) throw new Error(`Unknown family: ${family}`);
  }
  assertCoverage(
    inventory.screens,
    manifest.actions.flatMap((action) => action.screens),
    "screens",
  );
  assertCoverage(inventory.destinations, manifest.destinationCoverage, "destinations");
  assertCoverage(inventory.keywords, Object.keys(manifest.keywordCoverage), "keywords");
  const contentMappingIds = new Set([
    ...inventory.cards.map(({ id }) => `card:${id}`),
    ...inventory.enemies.map(({ id }) => `enemy:${id}`),
    ...inventory.companions.map(({ id }) => `companion:${id}`),
  ]);
  for (const [dependent, source] of Object.entries(manifest.sharedChoices ?? {})) {
    if (
      !contentMappingIds.has(dependent) ||
      !contentMappingIds.has(source) ||
      dependent === source ||
      manifest.sharedChoices[source]
    )
      throw new Error(`Invalid shared sound choice: ${dependent} -> ${source}`);
    const familyFor = (id) => {
      const [kind, key] = id.split(":");
      return manifest.assignments[kind === "enemy" ? "enemies" : kind === "companion" ? "companions" : "cards"][key];
    };
    if (familyFor(dependent) !== familyFor(source))
      throw new Error(`Shared choices need the same candidates: ${dependent}`);
  }
  for (const [keyword, actionIds] of Object.entries(manifest.keywordCoverage))
    for (const id of actionIds)
      if (!ids.has(id) && !contentMappingIds.has(id)) throw new Error(`Unknown action ${id} for ${keyword}`);
  for (const table of ["battleEventSounds", "uiSounds", "stingerSounds"]) {
    const assigned = manifest.actions
      .filter((action) => action.current?.startsWith(`${table}.`))
      .map((action) => action.current.split(".")[1]);
    assertCoverage(Object.keys(inventory.registry[table]), assigned, table);
  }
  for (const sequence of manifest.sequences)
    for (const step of sequence.steps) {
      if (!ids.has(step.mapping) && !step.mapping.startsWith("card:"))
        throw new Error(`Unknown sequence step: ${step.mapping}`);
      if (step.mapping.startsWith("card:") && !manifest.assignments.cards[step.mapping.slice(5)])
        throw new Error(`Unknown sequence card: ${step.mapping}`);
      if (!Number.isFinite(step.at) || step.at < 0) throw new Error(`Invalid sequence time: ${sequence.id}`);
    }
}

async function sourceFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const name = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(name)));
    else if (/\.(ts|tsx)$/.test(name)) files.push(name);
  }
  return files;
}

// Evidence is an inspection index, not a claim that a string occurrence executes.
export async function collectAudioEvidence(root) {
  const evidence = [];
  for (const file of await sourceFiles(path.join(root, "src"))) {
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      if (
        /play(?:CardSound|EnemyAttack|BattleEvent|UISound|GoldGain|GoldSpend|Victory|Defeat|CompanionSound)\(/.test(
          line,
        ) ||
        /"(?:shopRefresh|shopRemove|alchemistMix)"/.test(line)
      )
        evidence.push({ file: path.relative(root, file), line: i + 1, text: line.trim() });
    });
  }
  return evidence;
}

export function buildMappings(manifest, inventory, catalog, currentIdentity) {
  validateMappings(manifest, inventory, catalog);
  const assets = new Map(catalog.map((asset) => [asset.asset_id, asset]));
  const families = new Map(manifest.families.map((family) => [family.id, family]));
  const mappings = manifest.actions.map((action) => {
    const [table, key] = action.current?.split(".") ?? [];
    const sound = action.current ? inventory.registry[table][key] : null;
    return {
      ...action,
      currentFiles: typeof sound === "string" ? [sound] : [],
      ...(sound === null ? { currentState: "silent" } : {}),
    };
  });
  for (const kind of ["cards", "enemies", "companions"]) {
    for (const entity of inventory[kind]) {
      const key = kind === "companions" ? `${entity.id}-companion` : entity.id;
      const registry = kind === "enemies" ? "enemyAttackSounds" : "cardSounds";
      const currentFiles = inventory.registry[registry][key] ?? [];
      mappings.push({
        id: `${kind === "enemies" ? "enemy" : kind.slice(0, -1)}:${entity.id}`,
        title: entity.title,
        group: kind === "enemies" && entity.enemyType === "boss" ? "Bosses" : kind[0].toUpperCase() + kind.slice(1),
        family: manifest.assignments[kind][entity.id],
        currentFiles,
        currentState: currentFiles.length ? "playing" : "silent",
        screens: ["battle", "collection"],
        trigger:
          kind === "cards"
            ? "Accepted card play; also used by enemies playing this ability."
            : kind === "enemies"
              ? "Bestiary attack preview or fallback attack without an ability card."
              : "Summoning card and companion turn effect.",
        note:
          kind === "enemies"
            ? "Ability turns use the ability card cue first. This fallback does not replace those sounds."
            : kind === "companions"
              ? "Summoning and turn effects share the focal recording; compare repeated playback at a restrained level."
              : "One focal cue per accepted play; routine effect layers are suppressed, with at most one resolved special accent.",
        priority:
          (kind === "enemies" && entity.enemyType === "boss") ||
          (kind === "cards" && !currentFiles.length && entity.keywords.includes("archery"))
            ? "P1"
            : "P2",
        evidence:
          kind === "enemies"
            ? [
                "src/features/alchemy/run-loop/battle/end-turn-ui.ts",
                "src/features/alchemy/meta/screens/collection/collection-tile.tsx",
              ]
            : kind === "companions"
              ? ["src/features/alchemy/run-loop/battle/controller-utils.ts", "src/lib/game-data/companions.ts"]
              : [
                  "src/features/alchemy/run-loop/battle/battle-card-play.ts",
                  "src/lib/game-data/cards/library/cards.ts",
                ],
        keywords: entity.keywords ?? [],
        abilityMappings: entity.abilityIds?.map((id) => `card:${id}`) ?? [],
      });
    }
  }
  return mappings.map((mapping) => {
    const family = families.get(mapping.family);
    const candidates = family.candidates.map((candidate) => {
      const asset = assets.get(candidate.assetId);
      const identicalTo = mapping.currentFiles.filter((file) => {
        const identity = currentIdentity[file];
        return (
          identity &&
          ([asset.original_sha256, asset.stored_sha256].some((hash) => identity.hashes.includes(hash)) ||
            (identity.approvedExcerpt?.assetId === candidate.assetId &&
              identity.approvedExcerpt.start === candidate.start &&
              identity.approvedExcerpt.duration === candidate.duration))
        );
      });
      return {
        ...candidate,
        originalName: asset.original_names,
        source: asset.source_libraries,
        licenseReference: asset.license_reference,
        provenanceIds: asset.provenance_ids,
        originalSha256: asset.original_sha256,
        storedSha256: asset.stored_sha256,
        originalDuration: Number(asset.duration_seconds) || null,
        reviewRequired: asset.review_required === "True",
        identicalTo,
        auditionStatus: "unheard",
        confidence: "metadata-only",
      };
    });
    const status = !candidates.length
      ? family.silenceReason
        ? "silence"
        : "gap"
      : mapping.currentState !== "playing"
        ? "addition"
        : candidates[0].identicalTo.length
          ? "retained"
          : "replacement";
    return {
      ...mapping,
      choiceFrom: manifest.sharedChoices?.[mapping.id],
      note:
        mapping.id === "enemy:will-o-wisp"
          ? `${mapping.note} This choice also sets the Will-o'-Wisp companion and its summoning card.`
          : mapping.note,
      candidates,
      status,
      rationale: family.rationale,
      familyTitle: family.title,
      silenceReason: family.silenceReason ?? null,
    };
  });
}

export async function inspectLibrary(catalog, libraryRoot) {
  const missing = [];
  for (const entry of catalog) {
    const file = containedPath(libraryRoot, entry.path);
    try {
      if (!(await stat(file)).isFile()) missing.push(entry.path);
    } catch (error) {
      if (error.code === "ENOENT") missing.push(entry.path);
      else throw error;
    }
  }
  return missing;
}

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

import { expandRepositoryPaths } from "./repository-paths.mjs";
import { resolveRoutePlan } from "./change-routes.mjs";
import { readDocumentSection } from "./document-sections.mjs";

const owner = (path, heading) => ({ path, heading });
const workflow = (heading) => owner("docs/WORKFLOWS.md", heading);
const asset = (heading) => owner("docs/WORKFLOWS-ASSETS.md", heading);
const assetCommon = [asset("Shared asset requirements"), asset("Skip mode and verification")];

export const CONTEXT_TASKS = {
  battle: {
    matches: /^(?:src\/lib\/(?:battle|game-constants)|tests\/lib\/battle)\//u,
    docs: [
      owner("docs/ARCHITECTURE.md", "Battle path"),
      owner("docs/GAME_RULES.md", "Engine invariants"),
      owner("docs/GAME_RULES.md", "Turn order and resources"),
    ],
    entrypoints: ["src/lib/battle/card-play.ts", "src/lib/battle/effect-handlers"],
    fixture: "src/lib/battle/card-play.ts",
  },
  card: {
    matches: /^src\/lib\/game-data\/cards\//u,
    docs: [workflow("Add a new card")],
    entrypoints: ["src/lib/game-data/cards/library/cards.ts"],
    fixture: "src/lib/game-data/cards/library/archery.ts",
  },
  effect: {
    matches: /^(?:src\/lib\/game-data\/effects\/|src\/lib\/battle\/effect-handlers\/)/u,
    docs: [owner("src/lib/game-data/effects/BATTLE_HANDLERS.md", "Adding a kind")],
    entrypoints: ["src/lib/game-data/effects/registry.ts", "src/lib/battle/effect-handlers/registry.ts"],
    fixture: "src/lib/game-data/effects/registry.ts",
  },
  talent: {
    matches: /^src\/lib\/game-data\/(?:talents(?:\/|\.ts$)|talent-effect-manifest\.ts$)/u,
    docs: [workflow("Add a new talent")],
    entrypoints: [
      "src/lib/game-data/talents/talent-pool-definitions.ts",
      "src/lib/game-data/talent-effect-manifest.ts",
    ],
    fixture: "src/lib/game-data/talents/talent-pool-definitions.ts",
  },
  companion: {
    matches: /^src\/lib\/(?:game-data\/companions\.ts|battle\/companion[^/]*\.ts)$/u,
    docs: [workflow("Add a new companion"), owner("docs/GAME_RULES.md", "Companion Bond")],
    entrypoints: ["src/lib/game-data/companions.ts"],
    fixture: "src/lib/game-data/companions.ts",
  },
  enemy: {
    matches: /^src\/lib\/game-data\/compendium\/enemies\.ts$/u,
    docs: [workflow("Add a new enemy"), owner("docs/GAME_RULES.md", "Enemy abilities and traits")],
    entrypoints: ["src/lib/game-data/compendium/enemies.ts"],
    fixture: "src/lib/game-data/compendium/enemies.ts",
  },
  "enemy-ability": {
    matches: /^src\/lib\/(?:game-data\/enemy-abilities|battle\/enemy-turn-attack)\.ts$/u,
    docs: [
      owner("src/lib/game-data/effects/BATTLE_HANDLERS.md", "Enemy abilities"),
      owner("docs/GAME_RULES.md", "Enemy abilities and traits"),
    ],
    entrypoints: ["src/lib/game-data/enemy-abilities.ts", "src/lib/battle/enemy-turn-attack.ts"],
    fixture: "src/lib/game-data/enemy-abilities.ts",
  },
  ui: {
    matches: /(?:\/(?:ui|screens)\/|^src\/styles\/)/u,
    docs: [
      owner("docs/UI.md", "Placement and boundaries"),
      owner("docs/UI.md", "Component conventions"),
      owner("docs/UI.md", "Verification"),
    ],
    entrypoints: ["src/features/alchemy/shared/ui", "src/styles/components.css"],
  },
  overlay: {
    matches:
      /(?:overlay|dialog|modal|use-fade|screen-transition|screen-navigation|use-app-navigation|route-commands|game-menu)/u,
    docs: [owner("docs/UI.md", "Overlay lifecycle")],
    entrypoints: ["src/features/alchemy/shared/ui/modal-overlay-shell.tsx"],
  },
  audio: {
    matches: /^(?:src|tests)\/lib\/audio\//u,
    docs: [owner("docs/AUDIO.md", null)],
    entrypoints: ["src/lib/audio/index.ts", "src/lib/audio/sound-registry.ts"],
  },
  tooltip: {
    matches: /(?:tooltip|card-description|keyword-text)/u,
    docs: [owner("docs/UI.md", "Hover tooltips")],
    entrypoints: ["src/lib/keyword-text.ts", "src/features/alchemy/shared/ui/card-description-ui.tsx"],
  },
  gear: {
    matches: /(?:\/gear\/(?!affix)|\/armory\/|gear-store)/u,
    docs: [owner("docs/ARMORY.md", "State flow"), owner("docs/ARMORY.md", "Tests")],
    entrypoints: ["src/features/alchemy/meta/screens/armory/use-armory-controller.ts"],
  },
  affix: {
    matches: /\/gear\/affix/u,
    docs: [owner("docs/ARMORY.md", "Data model")],
    entrypoints: ["src/lib/gear/affix-catalog.ts", "src/lib/gear/affix-pool.ts"],
    fixture: "src/lib/gear/affix-catalog.ts",
  },
  rewards: {
    matches: /(?:victory|reward|run-materials)/u,
    docs: [workflow("Grant materials during a run"), workflow("Add or change post-victory routing (`REWARD_ROUTES`)")],
    entrypoints: ["src/features/alchemy/run-loop/navigation/victory-flow.ts"],
  },
  shop: {
    matches: /\/shop\//u,
    docs: [workflow("Change a shop"), owner("docs/ARCHITECTURE.md", "Shop commands")],
    entrypoints: ["src/features/alchemy/run-loop/shop/shop-transactions.ts"],
  },
  save: {
    matches: /(?:\/storage\/|\/save-schemas\/|run-resume)/u,
    docs: [
      workflow("Change persisted save data"),
      owner("src/features/alchemy/shared/storage/MIGRATIONS.md", "Public save contract"),
    ],
    entrypoints: ["src/features/alchemy/shared/storage/io.ts", "src/lib/validation/save-schemas"],
  },
  "run-state": {
    matches: /(?:\/stores\/|run-session|run-state)/u,
    docs: [owner("docs/ARCHITECTURE.md", "Run state"), workflow("Gameplay command boundary")],
    entrypoints: [
      "src/features/alchemy/shared/stores/run-session-command.ts",
      "src/features/alchemy/shared/stores/run-session-write-port.ts",
    ],
    fixture: "src/features/alchemy/shared/stores/run-session-command.ts",
  },
  "run-persistence": {
    matches: /(?:\/storage\/|\/save-schemas\/|run-resume|run-session-lifecycle|run-lifecycle)/u,
    docs: [owner("docs/ARCHITECTURE.md", "Persistence API")],
    entrypoints: ["src/features/alchemy/shared/stores/run-session-lifecycle-port.ts"],
  },
  "run-ports": {
    matches: /(?:run-reads|run-session-(?:read|write)-port|route-commands)/u,
    docs: [owner("docs/ARCHITECTURE.md", "Session capability ports")],
    entrypoints: ["src/features/alchemy/shared/stores/run-reads.ts"],
  },
  "run-randomness": {
    matches: /(?:run-rng|run-random|draft-world|\/rng(?:\/|\.))/u,
    docs: [owner("docs/ARCHITECTURE.md", "Run randomness")],
    entrypoints: ["src/lib/rng/index.ts"],
  },
  "run-setup": {
    matches: /(?:\/run-setup\/|run-start|starter-draft)/u,
    docs: [owner("docs/ARCHITECTURE.md", "Run setup ownership")],
    entrypoints: ["src/features/alchemy/run-setup"],
  },
  assets: {
    matches: /^(?:Raw Assets|src\/assets|scripts\/assets)\//u,
    docs: assetCommon,
    entrypoints: ["scripts/assets.mjs", "scripts/assets/asset-manifest.mjs"],
  },
  "assets-art": {
    matches:
      /^(?:scripts\/assets\/(?:core|card|content|talent)-assets\.mjs|src\/lib\/game-data\/assets(?:\.generated)?\.ts|Raw Assets\/(?!Gear\/|Music\/|Sound Effects\/)|src\/assets\/optimized\/)/u,
    docs: [
      ...assetCommon,
      asset("Add or replace game art"),
      asset("Resource and battle UI masters"),
      asset("Importing art — barrel is the canonical surface"),
    ],
    entrypoints: ["scripts/assets/asset-manifest.mjs"],
  },
  "assets-gear": {
    matches: /^(?:Raw Assets\/Gear\/|src\/lib\/game-data\/gear-art\.ts|scripts\/sync-art-barrels\.mjs)/u,
    docs: [...assetCommon, asset("Add or replace Gear art"), asset("Importing art — barrel is the canonical surface")],
    entrypoints: ["scripts/sync-art-barrels.mjs"],
  },
  "assets-sound": {
    matches:
      /^(?:Raw Assets\/Sound Effects\/|public\/sounds\/|scripts\/(?:assets\/sound-assets|optimize-sounds|lib\/audio-optimizer)\.mjs|src\/lib\/audio\/sound-registry\.ts)/u,
    docs: [...assetCommon, asset("Add or replace sound")],
    entrypoints: ["scripts/assets/sound-assets.mjs"],
  },
  "assets-music": {
    matches: /^(?:Raw Assets\/Music\/|public\/Music\/|scripts\/optimize-music\.mjs|src\/lib\/audio\/music\.ts)/u,
    docs: [...assetCommon, asset("Add or replace music")],
    entrypoints: ["scripts/optimize-music.mjs"],
  },
  "assets-pipeline": {
    matches:
      /^scripts\/(?:assets|prepare-assets|optimize-assets|optimize-pipelines|check-prepared-assets|check-generated-fast|sync-generated|sync-art-barrels|lib\/asset-[^/]+|lib\/registry-validation|lib\/audio-optimizer)\.mjs$/u,
    docs: [
      ...assetCommon,
      asset("Pipeline overview"),
      asset("Content freshness and filesystem failures"),
      asset("Authoring models"),
      asset("Strict generated-art inputs"),
    ],
    entrypoints: ["scripts/prepare-assets.mjs"],
  },
  browser: {
    matches: /(?:\.spec\.ts$|^tests\/(?:e2e|electron|pages|fixtures)\/)/u,
    docs: [
      owner("CONTRIBUTING.md", "Test value and coverage strategy"),
      owner("tests/e2e/README.md", "Choosing browser coverage"),
      owner("tests/e2e/README.md", "Running focused checks"),
      owner("tests/e2e/README.md", "Navigation and bootstrap"),
    ],
    entrypoints: ["tests/playwright-shared.ts", "tests/e2e/README.md"],
  },
  tooling: {
    matches: /^(?:scripts\/|tests\/scripts\/|\.agents\/)/u,
    docs: [owner("docs/REFERENCE.md", "Tooling ownership")],
    entrypoints: ["scripts/lib/change-routes.mjs", "scripts/README.md"],
  },
  verification: {
    matches:
      /^(?:scripts\/(?:check|verify-changed|lib\/(?:change-routes|changed-paths|run-step|verification-cache|test-commands))\.mjs|tests\/scripts\/(?:check|verify-changed|verification-cache)\.test\.ts)$/u,
    docs: [
      owner("scripts/README.md", "Checks / verification (nesting order)"),
      owner("CONTRIBUTING.md", "What to run when you change…"),
    ],
    entrypoints: ["scripts/check.mjs", "scripts/verify-changed.mjs", "scripts/lib/change-routes.mjs"],
    fixture: "scripts/check.mjs",
  },
  discovery: {
    matches:
      /^(?:scripts\/(?:agent-(?:context|search|eval)|measure-agent-context|context-hotspots|lib\/agent-(?:context|discovery|events))\.mjs|tests\/scripts\/agent-(?:context|discovery|eval)\.test\.ts)$/u,
    docs: [owner("docs/REFERENCE.md", "Agent discovery")],
    entrypoints: ["scripts/lib/agent-context.mjs"],
  },
};

// Verification routes remain conservative. Only safety owners and genuinely
// uncategorized work inherit their documentation; asset/tooling guidance above
// is selected independently so broad test selection cannot force whole manuals.
const FALLBACK_DOC_ROUTES = new Set(["save", "balance", "performance", "desktop", "documentation", "unit-test"]);

export function selectContext(paths, task) {
  paths = expandRepositoryPaths(path.resolve(import.meta.dirname, "../.."), paths);
  if (task && !Object.hasOwn(CONTEXT_TASKS, task)) {
    const alternate = task.endsWith("s") ? task.slice(0, -1) : `${task}s`;
    if (Object.hasOwn(CONTEXT_TASKS, alternate)) task = alternate;
  }
  if (task && !Object.hasOwn(CONTEXT_TASKS, task))
    throw new Error(`Unknown task: ${task}. Choose ${Object.keys(CONTEXT_TASKS).join(", ")}`);
  const selected = Object.entries(CONTEXT_TASKS).filter(
    ([id, entry]) => id === task || paths.some((file) => entry.matches.test(file)),
  );
  const plan = resolveRoutePlan(paths);
  const docs = selected.flatMap(([, entry]) => entry.docs);
  for (const route of plan.routes) {
    if (FALLBACK_DOC_ROUTES.has(route.id)) docs.push(...route.docs);
    if (route.id === "browser-test" && !selected.some(([id]) => id === "browser"))
      docs.push(...CONTEXT_TASKS.browser.docs);
    if (route.id === "tooling") docs.push(...CONTEXT_TASKS.tooling.docs);
    if (route.id === "assets") docs.push(...assetCommon);
    if (
      route.id === "runtime" &&
      paths
        .filter((file) => /^(?:src\/|public\/|index\.html$)/u.test(file))
        .some((file) => !selected.some(([, entry]) => entry.matches.test(file)))
    )
      docs.push(...route.docs);
  }
  const assetWork =
    selected.some(([id]) => id.startsWith("assets")) || plan.routes.some((route) => route.id === "assets");
  const runStateWork = selected.some(([id]) => id === "run-state");
  const pointers = Object.entries(CONTEXT_TASKS)
    .filter(
      ([id]) =>
        ((assetWork && id.startsWith("assets-")) ||
          (runStateWork && ["run-persistence", "run-ports", "run-randomness", "run-setup"].includes(id))) &&
        !selected.some(([selectedId]) => selectedId === id),
    )
    .map(([task, entry]) => ({ task, ...entry.docs[task.startsWith("assets-") ? assetCommon.length : 0] }));
  const unique = new Map(docs.map((doc) => [`${doc.path}#${doc.heading ?? ""}`, doc]));
  const wholeFiles = new Set([...unique.values()].filter((doc) => !doc.heading).map((doc) => doc.path));
  return {
    tasks: selected.map(([id]) => id),
    pointers,
    docs: [...unique.values()].filter((doc) => !doc.heading || !wholeFiles.has(doc.path)),
    entrypoints: [
      ...new Set(
        selected
          .filter(([id]) => id !== "tooling" || !selected.some(([task]) => task === "verification"))
          .flatMap(([, entry]) => entry.entrypoints),
      ),
    ],
    plan,
  };
}

export function contextSections(rootDir, selection) {
  const sections = selection.docs.map((doc) => readDocumentSection(rootDir, doc.path, doc.heading));
  return sections.filter(
    (section, index) =>
      !sections.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.path === section.path &&
          other.start <= section.start &&
          other.end >= section.end &&
          (other.start < section.start || other.end > section.end || otherIndex < index),
      ),
  );
}

export function sourceOutline(rootDir, relativePath, { entries = false } = {}) {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  const location = (node, name) => ({
    name,
    path: relativePath,
    start: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    end: file.getLineAndCharacterOfPosition(node.end).line + 1,
    text: node.getText(file),
  });
  if (entries) {
    const found = [];
    const literalName = (node) =>
      node && (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isIdentifier(node)) ? node.text : null;
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const id = node.properties.find(
          (property) => ts.isPropertyAssignment(property) && literalName(property.name) === "id",
        );
        if (id && (ts.isStringLiteral(id.initializer) || ts.isNumericLiteral(id.initializer)))
          found.push(location(node, id.initializer.text));
        else if (ts.isPropertyAssignment(node.parent)) {
          const name = literalName(node.parent.name);
          if (name) found.push(location(node.parent, name));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }
  return file.statements.flatMap((statement) => {
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((declaration) => declaration.name.getText(file))
      : statement.name
        ? [statement.name.getText(file)]
        : [];
    return names.map((name) => ({
      name,
      path: relativePath,
      start: file.getLineAndCharacterOfPosition(statement.getStart(file)).line + 1,
      end: file.getLineAndCharacterOfPosition(statement.end).line + 1,
      text: statement.getText(file),
    }));
  });
}

export function validateContextCatalog(rootDir) {
  const errors = [];
  for (const [id, entry] of Object.entries(CONTEXT_TASKS)) {
    for (const doc of entry.docs) {
      try {
        readDocumentSection(rootDir, doc.path, doc.heading);
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    }
    if (entry.fixture && (!fs.existsSync(path.join(rootDir, entry.fixture)) || !entry.matches.test(entry.fixture)))
      errors.push(`${id}: discovery fixture must exist and match its category: ${entry.fixture}`);
    for (const file of entry.entrypoints)
      if (!fs.existsSync(path.join(rootDir, file))) errors.push(`${id}: missing ${file}`);
  }
  return errors;
}

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

import { resolveRoutePlan } from "./change-routes.mjs";
import { readDocumentSection } from "./document-sections.mjs";

const owner = (path, heading) => ({ path, heading });
const workflow = (heading) => owner("docs/WORKFLOWS.md", heading);

export const CONTEXT_TASKS = {
  battle: {
    matches: /^(?:src\/lib\/(?:battle|game-constants)|tests\/lib\/battle)\//u,
    docs: [owner("docs/ARCHITECTURE.md", "Battle path"), owner("docs/GAME_RULES.md", "Battle Implementation Rules")],
    entrypoints: ["src/lib/battle/card-play.ts", "src/lib/battle/effect-handlers"],
  },
  card: {
    matches: /^src\/lib\/game-data\/(?:cards|effects)\//u,
    docs: [workflow("Add a new card"), workflow("Add a new card effect `kind`")],
    entrypoints: ["src/lib/game-data/cards/library/cards.ts", "src/lib/game-data/effects/registry.ts"],
  },
  ui: {
    matches: /(?:\/(?:ui|screens)\/|^src\/styles\/)/u,
    docs: [
      owner("docs/UI.md", "Placement and boundaries"),
      owner("docs/UI.md", "Component conventions"),
      owner("docs/UI.md", "Overlay lifecycle"),
      owner("docs/UI.md", "Verification"),
    ],
    entrypoints: ["src/features/alchemy/shared/ui", "src/styles/components.css"],
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
    matches: /(?:\/gear\/|\/armory\/|gear-store)/u,
    docs: [owner("docs/ARMORY.md", "State flow"), owner("docs/ARMORY.md", "Tests")],
    entrypoints: ["src/features/alchemy/meta/screens/armory/use-armory-controller.ts"],
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
  },
  assets: {
    matches: /^(?:Raw Assets|src\/assets|scripts\/assets)\//u,
    docs: [owner("docs/WORKFLOWS-ASSETS.md", null)],
    entrypoints: ["scripts/assets.mjs", "scripts/assets/asset-manifest.mjs"],
  },
  browser: {
    matches: /(?:\.spec\.ts$|^tests\/(?:e2e|electron|pages|fixtures)\/)/u,
    docs: [
      owner("tests/e2e/README.md", "Running focused checks"),
      owner("tests/e2e/README.md", "Navigation and bootstrap"),
    ],
    entrypoints: ["tests/playwright-shared.ts", "tests/e2e/README.md"],
  },
  tooling: {
    matches: /^(?:scripts\/|tests\/scripts\/|\.agents\/)/u,
    docs: [owner("docs/REFERENCE.md", "Tooling ownership"), owner("docs/REFERENCE.md", "Agent discovery")],
    entrypoints: ["scripts/lib/change-routes.mjs", "scripts/README.md"],
  },
};

export function selectContext(paths, task) {
  paths = paths.map((file) => file.replaceAll("\\", "/").replace(/^\.\//u, ""));
  if (task && !Object.hasOwn(CONTEXT_TASKS, task))
    throw new Error(`Unknown task: ${task}. Choose ${Object.keys(CONTEXT_TASKS).join(", ")}`);
  const selected = Object.entries(CONTEXT_TASKS).filter(
    ([id, entry]) => id === task || paths.some((file) => entry.matches.test(file)),
  );
  const plan = resolveRoutePlan(paths);
  const docs = selected.flatMap(([, entry]) => entry.docs);
  for (const route of plan.routes) {
    if (route.id === "browser-test" && selected.some(([id]) => id === "browser")) continue;
    if (
      route.id === "runtime" &&
      paths
        .filter((file) => /^(?:src\/|public\/|index\.html$)/u.test(file))
        .every((file) => selected.some(([, entry]) => entry.matches.test(file)))
    )
      continue;
    docs.push(...route.docs);
  }
  const unique = new Map(docs.map((doc) => [`${doc.path}#${doc.heading ?? ""}`, doc]));
  const wholeFiles = new Set([...unique.values()].filter((doc) => !doc.heading).map((doc) => doc.path));
  return {
    tasks: selected.map(([id]) => id),
    docs: [...unique.values()].filter((doc) => !doc.heading || !wholeFiles.has(doc.path)),
    entrypoints: [...new Set(selected.flatMap(([, entry]) => entry.entrypoints))],
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
    for (const file of entry.entrypoints)
      if (!fs.existsSync(path.join(rootDir, file))) errors.push(`${id}: missing ${file}`);
  }
  return errors;
}

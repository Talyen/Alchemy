import fs from "node:fs";
import path from "node:path";
import { expandRepositoryPaths } from "../repository-paths.mjs";
import { readDocumentSection } from "./markdown-sections.mjs";

const owner = (path, heading = null) => ({ path, heading });
export const CONTEXT_TASKS = {
  battle: {
    matches: /(?:\/battle\/|game-constants\/(?:combat-rules|enemy|battle))/,
    docs: [owner("Docs/GAME_RULES.md", "Battle Implementation Rules"), owner("Docs/BATTLE_CONTROLLERS.md")],
    entrypoints: ["src/lib/battle/card-play.ts", "src/features/alchemy/run-loop/battle/battle-session.ts"],
  },
  "run-state": {
    matches:
      /(?:shared\/(?:stores|storage|run-flow)\/|run-loop\/(?:run|navigation)\/|run-setup\/|active-run-session\/|lib\/validation\/|autosave|alchemy-bootstrap)/,
    docs: [owner("Docs/RUN_STATE.md"), owner("src/features/alchemy/shared/storage/MIGRATIONS.md")],
    entrypoints: [
      "src/features/alchemy/shared/stores/run-session-command.ts",
      "src/features/alchemy/shared/stores/run-resume-codec.ts",
    ],
  },
  ui: {
    matches: /(?:\.(?:tsx|css)$|shared\/ui\/|src\/app\/|screen|tooltip)/,
    docs: [owner("Docs/UI.md")],
    entrypoints: ["src/app/screen-routes/index.tsx"],
  },
  audio: {
    matches: /(?:\/audio\/|game-constants\/audio|app-audio|app-effects)/,
    docs: [owner("Docs/AUDIO.md")],
    entrypoints: ["src/lib/audio/index.ts"],
  },
  content: {
    matches: /(?:game-data\/|content-validation\/|content-systems\/)/,
    docs: [owner("Docs/CONTENT_AUTHORING.md")],
    entrypoints: ["src/lib/game-data/index.ts"],
  },
  gear: {
    matches: /(?:\/gear\/|gear-store|gear-session|armory)/,
    docs: [owner("Docs/ARMORY.md")],
    entrypoints: ["src/features/alchemy/shared/stores/gear-store.ts"],
  },
  assets: {
    matches: /(?:assets|optimize-|sync-generated|public\/(?:Music|sounds)|Raw Assets)/,
    docs: [owner("Docs/WORKFLOWS-ASSETS.md")],
    entrypoints: ["scripts/assets.mjs"],
  },
  verification: {
    matches: /^(?:scripts\/|tests\/|\.github\/|\.agents\/|.*(?:config|CONTRIBUTING|AGENTS)|package\.json)/,
    docs: [owner("CONTRIBUTING.md"), owner("scripts/VERIFICATION.md")],
    entrypoints: ["scripts/check.mjs"],
  },
  release: {
    matches: /(?:desktop\/|steam\/|release|dist-desktop|game-edition)/,
    docs: [owner("Docs/RELEASE.md"), owner("Docs/STEAM_DEMO.md")],
    entrypoints: ["scripts/release.mjs"],
  },
};

export function selectContext(paths, task) {
  if (task && !Object.hasOwn(CONTEXT_TASKS, task))
    throw new Error(`Unknown task: ${task}. Choose ${Object.keys(CONTEXT_TASKS).join(", ")}`);
  const selected = Object.entries(CONTEXT_TASKS).filter(
    ([id, entry]) => id === task || paths.some((file) => entry.matches.test(file)),
  );
  const docs = selected.flatMap(([, entry]) => entry.docs);
  if (!selected.length && paths.length) docs.push(owner("Docs/ARCHITECTURE.md"));
  return {
    tasks: selected.map(([id]) => id),
    docs: [...new Map(docs.map((doc) => [`${doc.path}#${doc.heading ?? ""}`, doc])).values()],
    entrypoints: [...new Set(selected.flatMap(([, entry]) => entry.entrypoints))],
  };
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
    for (const file of expandRepositoryPaths(rootDir, entry.entrypoints)) {
      if (!fs.existsSync(path.join(rootDir, file))) errors.push(`${id}: missing ${file}`);
    }
  }
  return errors;
}

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
    matches: /(?:\.(?:tsx|css)$|shared\/ui\/|screen|tooltip)/,
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
  settings: {
    matches: /(?:settings(?:-|\.|\/)|device-display|\/screens\/options(?:\/|-))/,
    docs: [owner("Docs/ARCHITECTURE.md", "Settings and meta profile"), owner("Docs/UI_BROWSING.md", "Options")],
    entrypoints: ["src/lib/settings-values.ts", "src/features/alchemy/shared/stores/settings-store.ts"],
  },
  shop: {
    matches: /(?:\/shop\/|shop-(?:screen|persistence|offering)|-shop-screen)/,
    docs: [owner("Docs/ARCHITECTURE.md", "Shop commands"), owner("Docs/WORKFLOWS.md", "Change a shop")],
    entrypoints: ["src/features/alchemy/run-loop/shop/shop-commands-core.ts"],
  },
  progression: {
    matches:
      /(?:\/(?:homestead|talents)\/|\/(?:homestead|talents)[.-]|game-constants\/(?:progression|materials-economy))/,
    docs: [
      owner("Docs/TALENT_RULES.md", "Talent manifests and progression"),
      owner("Docs/ARMORY.md", "Materials tuning"),
    ],
    entrypoints: ["src/lib/game-data/talents/progression.ts", "src/lib/homestead/material-rewards.ts"],
  },
  rewards: {
    matches: /(?:\/loot\/|\/reward-|\/rewards?-screen|game-constants\/run-rewards)/,
    docs: [
      owner("Docs/ARMORY.md", "Loot tuning"),
      owner("Docs/RUN_WORKFLOWS.md", "Grant materials during a run"),
      owner("Docs/RUN_WORKFLOWS.md", "Add or change post-victory routing (`REWARD_ROUTES`)"),
    ],
    entrypoints: ["src/lib/loot/policy.ts", "src/features/alchemy/run-loop/navigation/reward-flow.ts"],
  },
  assets: {
    matches: /(?:assets|optimize-|sync-generated|public\/(?:Music|sounds)|Raw Assets)/,
    docs: [owner("Docs/WORKFLOWS-ASSETS.md")],
    entrypoints: ["scripts/assets.mjs"],
  },
  verification: {
    matches: /^(?:scripts\/|tests\/(?:scripts|architecture|e2e)\/|\.github\/|.*(?:config|CONTRIBUTING)|package\.json)/,
    docs: [
      owner("CONTRIBUTING.md", "What to run when you change…"),
      owner("scripts/VERIFICATION.md", "Checks / verification (nesting order)"),
    ],
    entrypoints: ["scripts/check.mjs"],
  },
  agents: {
    matches: /^(?:AGENTS\.md$|\.agents\/|scripts\/(?:agent-|lib\/agent\/)|tests\/scripts\/agent-)/,
    docs: [owner("Docs/AGENT_DISCOVERY.md"), owner("scripts/README.md", "Agent owner lookup")],
    entrypoints: ["scripts/agent-context.mjs", "scripts/agent-diff.mjs"],
  },
  playthrough: {
    matches:
      /^(?:src\/app\/playthrough\/|tests\/playthrough\/|scripts\/run-playthrough\.mjs$|vitest\.playthrough\.config\.ts$)/,
    docs: [owner("Docs/PLAYTHROUGH_SIMULATION.md")],
    entrypoints: ["src/app/playthrough/career.ts", "scripts/run-playthrough.mjs"],
  },
  release: {
    matches: /(?:desktop\/|steam\/|release|dist-desktop|game-edition)/,
    docs: [owner("Docs/RELEASE.md"), owner("Docs/STEAM_DEMO.md")],
    entrypoints: ["scripts/release.mjs"],
  },
};

export function selectContext(paths, task = []) {
  const tasks = typeof task === "string" ? [task] : task;
  for (const topic of tasks)
    if (!Object.hasOwn(CONTEXT_TASKS, topic))
      throw new Error(`Unknown task: ${topic}. Choose ${Object.keys(CONTEXT_TASKS).join(", ")}`);
  const matches = (entry, file) => entry.matches.test(file) || entry.docs.some((doc) => doc.path === file);
  const selected = Object.entries(CONTEXT_TASKS).filter(
    ([id, entry]) => tasks.includes(id) || paths.some((file) => matches(entry, file)),
  );
  const docs = selected.flatMap(([, entry]) => entry.docs);
  if (paths.some((file) => !selected.some(([, entry]) => matches(entry, file))))
    docs.push(owner("Docs/ARCHITECTURE.md"));
  const wholeDocs = new Set(docs.filter((doc) => !doc.heading).map((doc) => doc.path));
  return {
    tasks: selected.map(([id]) => id),
    docs: [
      ...new Map(
        docs
          .filter((doc) => !doc.heading || !wholeDocs.has(doc.path))
          .map((doc) => [`${doc.path}#${doc.heading ?? ""}`, doc]),
      ).values(),
    ],
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

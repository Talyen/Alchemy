import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log } from "node:console";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error("Choose a fresh staging directory");
fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
const dependencies = Object.keys(JSON.parse(fs.readFileSync(path.join(root, "package.json"))).dependencies).filter(
  (n) => !["@sentry/electron", "steamworks.js"].includes(n),
);
const server = await createServer({
  root,
  define: { "import.meta.env.DEV": "false" },
  cacheDir: path.join(root, "scratch/trailer-vite-cache"),
  server: { host: "127.0.0.1", port: 0, open: false, hmr: false, watch: null },
  optimizeDeps: {
    noDiscovery: true,
    include: [...dependencies, "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "motion/react"],
  },
  logLevel: "warn",
});
let browser;
try {
  await server.listen();
  await Promise.all([server.warmupRequest("/src/startup.ts"), server.warmupRequest("/src/main.tsx")]);
  await server.environments.client.waitForRequestsIdle();
  const g = await server.ssrLoadModule("/src/lib/game-data/index.ts");
  const gear = await server.ssrLoadModule("/src/lib/gear/index.ts");
  const { buildActiveRunSave, readSavedGame } = await server.ssrLoadModule("/tests/e2e/save-injection.ts");
  const { savedActivityFixture } = await server.ssrLoadModule("/tests/fixtures/run-activity.ts");
  const scenarios = await server.ssrLoadModule("/tests/trailers/scenarios.ts");
  const { waitForBattleReady } = await server.ssrLoadModule("/performance/battle-setup.ts");
  const unlocked = g
    .getTalentsForKeyword("block")
    .slice(0, 4)
    .map((t) => t.id);
  const talentXP = { block: g.xpThresholdForPoints(4) };
  const maxHealth = g.computeStartingMaxHealth(talentXP);
  const inventory = gear.createEmptyGearInventories();
  inventory.knight = [{ instanceId: "director-winters-credit", definitionId: "winters-credit", affixes: [] }];
  const loadouts = gear.createEmptyGearLoadouts();
  loadouts.knight["left-accessory"] = "director-winters-credit";
  const profile = {
    ...buildActiveRunSave({
      characterId: "knight",
      runDeck: g.getStartingDeck("knight").map((c, i) => ({ ...c, uid: i + 1 })),
      runPlayerHealth: maxHealth,
      runMaxHealth: maxHealth,
      currentAct: 2,
      roomsEncountered: 7,
      destinationIndexInAct: 7,
      completedDestinations: Array(7).fill("Normal Combat"),
      gold: 85,
      autoEndTurn: false,
      selectedDifficulty: "difficulty-1",
      activity: savedActivityFixture("destination", {
        destinations: ["Boss Combat"],
        selectedBossId: "blood-countess",
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
    }),
    talentXP,
    unlockedTalents: { block: unlocked },
    gearInventories: inventory,
    gearLoadouts: loadouts,
    autoEquip: false,
  };
  write("profile-before-battle.json", profile);
  write("loadout-provenance.json", {
    purpose: "Staged legal build using unmodified catalog definitions;not an uninterrupted earned run",
    hero: "knight",
    deck: "getStartingDeck(knight),unmodified",
    talents: unlocked,
    talentXP,
    computedMaxHealth: maxHealth,
    gear: inventory.knight,
    gearRollSource: "getUniqueAffixView(winters-credit),catalog-authored values",
    noBattleStatOverrides: true,
    sourceRevision: process.env.ALCHEMY_SOURCE_REVISION ?? null,
  });
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${server.httpServer.address().port}`,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await scenarios.openTrailerScene(page, { scene: "checkpoint", hero: "knight", seed: 42, lyrics: true }, profile);
  await page.getByRole("button", { name: "Boss - Act II", exact: true }).click();
  await waitForBattleReady(page);
  await page.waitForTimeout(800);
  const saved = await readSavedGame(page);
  write("countess-ready.json", saved);
  const state = saved.activeRun.activity.data.battleState;
  write("staging-review.json", {
    enemy: state.currentEnemy.id,
    health: [state.playerHealth, state.playerMaxHealth, state.enemyHealth, state.enemyMaxHealth],
    block: state.playerStatuses.block,
    forge: state.playerStatuses.forge,
    hand: state.hand.map((c) => ({ id: c.id, title: c.title, cost: c.cost, uid: c.uid })),
    talents: state.talentEffects,
    gear: state.gearEffects,
  });
  await page.screenshot({ path: path.join(out, "countess-ready.png") });
  log(
    JSON.stringify({
      enemy: state.currentEnemy.id,
      health: [state.playerHealth, state.playerMaxHealth, state.enemyHealth, state.enemyMaxHealth],
      block: state.playerStatuses.block,
      hand: state.hand.map((c) => c.title),
    }),
  );
} finally {
  if (browser) await browser.close();
  await server.close();
}

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
  const stunTalents = g
    .getTalentsForKeyword("stun")
    .slice(0, 2)
    .map((t) => t.id);
  const talentXP = { block: g.xpThresholdForPoints(4), stun: g.xpThresholdForPoints(2) };
  let maxHealth = g.computeStartingMaxHealth(talentXP);
  const inventory = gear.createEmptyGearInventories();
  inventory.knight = [
    { instanceId: "story-mace", definitionId: "mace-basic", affixes: [{ id: "flat-stun", value: 1 }] },
    {
      instanceId: "story-shield",
      definitionId: "kite-shield-basic",
      affixes: [
        { id: "block-gain", value: 1 },
        { id: "start-block", value: 4 },
      ],
    },
    { instanceId: "story-plate", definitionId: "leather-armor-basic", affixes: [{ id: "max-health", value: 7 }] },
  ];
  for (const item of inventory.knight) {
    const definition = gear.gearDefinitions[item.definitionId];
    const pool = gear.buildEligibleAffixPool(definition);
    if (definition.rarity !== "basic" || item.affixes.length > 2) throw new Error("Modest gear only");
    for (const roll of item.affixes) {
      const row = pool.find((x) => x.id === roll.id);
      if (!row || roll.value < row.roll.basic.min || roll.value > row.roll.basic.max)
        throw new Error("Invalid catalog roll");
    }
  }
  let loadouts = gear.createEmptyGearLoadouts();
  loadouts = gear.equipGear(loadouts, "knight", "main-hand", inventory.knight[0], inventory.knight);
  loadouts = gear.equipGear(loadouts, "knight", "off-hand", inventory.knight[1], inventory.knight);
  if (loadouts.knight["main-hand"] !== "story-mace" || loadouts.knight["off-hand"] !== "story-shield")
    throw new Error("Incompatible gear");

  loadouts = gear.equipGear(loadouts, "knight", "body", inventory.knight[2], inventory.knight);
  maxHealth += gear.computeGearManifest("knight", inventory.knight, loadouts).maxHealth;
  const profile = {
    ...buildActiveRunSave({
      characterId: "knight",
      runDeck: g.getStartingDeck("knight").map((c, i) => ({ ...c, uid: i + 1 })),
      runPlayerHealth: maxHealth,
      runMaxHealth: maxHealth,
      currentAct: 2,
      roomsEncountered: 15,
      destinationIndexInAct: 7,
      completedDestinations: Array(15).fill("Normal Combat"),
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
    unlockedTalents: { block: unlocked, stun: stunTalents },
    gearInventories: inventory,
    gearLoadouts: loadouts,
    autoEquip: false,
  };
  write("profile-before-battle.json", profile);
  write("loadout-provenance.json", {
    purpose: "Staged legal build using unmodified catalog definitions;not an uninterrupted earned run",
    hero: "knight",
    deck: "getStartingDeck(knight),unmodified",
    talents: { block: unlocked, stun: stunTalents },
    talentXP,
    computedMaxHealth: maxHealth,
    gear: inventory.knight,
    gearRollSource:
      "Three Basic items; canonical affinity pools, legal1-2affix counts and minimum Basic roll values; equipGear validated the Mace+Kite Shield hand pair",
    plausibility:
      "ActII boss after15encounters; six talents across Block and Stun,three ordinary low-roll items,no uniques,trinkets,extraMana or customcards",
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
  if (state.playerMaxHealth !== maxHealth)
    throw new Error("Native maximum Health differs from the canonical talent+gear calculation");
  if (
    state.gearEffects.startBlock !== 4 ||
    state.gearEffects.flatBlockGained !== 1 ||
    state.gearEffects.flatStunDamage !== 1
  )
    throw new Error("Native gear manifest differs from staged items");
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

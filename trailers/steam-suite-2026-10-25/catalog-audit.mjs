import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log } from "node:console";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { editionPolicy } from "../../game-edition.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const project = path.resolve(process.argv[2]);
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, logLevel: "error" });
try {
  const g = await server.ssrLoadModule("/src/lib/game-data/index.ts");
  const gear = await server.ssrLoadModule("/src/lib/gear/index.ts");
  const uniqueIds = (list) => [...new Set(list.map((x) => x.id))];
  const ids = {
    heroes: Object.keys(g.characters),
    talents: uniqueIds(g.talentPool),
    enemies: uniqueIds(g.encounterEnemies),
    uniqueItems: uniqueIds(gear.uniqueItemList),
    trinkets: uniqueIds(g.trinketLibrary),
    offerableCards: uniqueIds(g.getOfferableCardPool()),
  };
  const counts = Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, value.length]));
  const assets = {
    heroes: Object.entries(g.characterArt).map(([id, art]) => ({ id, art })),
    talents: ["block", "burn", "freeze", "forge", "nature"].map((id) => ({ id, art: g.talentArt[id] })),
    enemies: ["goblin", "skeleton", "slime"].map((id) => ({ id, art: g.enemyById[id].art })),
    uniqueItems: ["everkeen", "winters-credit", "wardbreaker"].map((id) => ({ id, art: gear.gearDefinitions[id].art })),
    trinkets: ["meteorite", "icy-heart", "obsidian-hammer"].map((id) => ({ id, art: g.trinketById[id].art })),
  };
  const artDir = path.join(project, "graphics/content-art");
  fs.mkdirSync(artDir, { recursive: true });
  for (const list of Object.values(assets))
    for (const item of list) {
      const local = path.resolve(root, item.art.replace(/^\//u, ""));
      if (!local.startsWith(root + path.sep) || !fs.existsSync(local))
        throw new Error("Missing local catalog art: " + item.art);
      const dest = path.join(artDir, item.id + path.extname(local));
      fs.copyFileSync(local, dest);
      item.localArt = path.relative(project, dest);
    }
  const audit = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    edition: "full",
    fullCounts: counts,
    ids,
    assets,
    demoPolicy: editionPolicy("demo"),
    rules: {
      heroes: "Unique playable IDs including unlockable Wildcard;exclude art variants.",
      talents: "Implemented talentPool nodes exposed by getAllocatableTalentChoices;eachID once.",
      enemies:
        "encounterEnemies IDs across normal,elite,boss pools;eachID once. Labyrinth generation consumes enemiesByType.",
      uniqueItems: "Authored uniqueItemList entries,not instances/rarity/affix rolls;all map to gearDefinitions.",
      trinkets: "trinketLibrary IDs,not instances.",
      offerableCards: "getOfferableCardPool IDs;exclude mixed potion template and generated variants.",
    },
    references: [
      "src/lib/game-data/characters.ts",
      "src/lib/game-data/character-unlocks.ts",
      "src/lib/game-data/talents/talent-pool-definitions.ts",
      "src/lib/game-data/talents/choices.ts",
      "src/lib/game-data/compendium.ts",
      "src/lib/content-systems/labyrinth/map-generation.ts",
      "src/lib/gear/unique-catalog.ts",
      "src/lib/gear/definitions.ts",
      "src/lib/game-data/compendium/trinkets.ts",
      "src/lib/game-data/cards/card-pools.ts",
      "game-edition.mjs",
    ],
    demoCaveat:
      "Fullgame headline counts are not demo counts. Demo explicitly limits heroes to3,modes tocampaign,and campaign toActI. Other category demo reachability is not fully audited.",
    visualRule: "Enemy art in Countess-song stat panels uses only nonbosses.",
    externalSharing: false,
  };
  fs.writeFileSync(path.join(project, "review/content-count-audit.json"), JSON.stringify(audit, null, 2) + "\n");
  log(JSON.stringify(counts));
} finally {
  await server.close();
}

import { LOOT_DEPTH_CURVES, LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import { trinketLibrary, type DifficultyId } from "@/lib/game-data";
import { generateLootGearChoices, gearDefinitions, getGearLootAvailability, uniqueItemList } from "@/lib/gear";
import { isLootEligible, resolveLootWeights, rollLootGroup, type LootSource } from "@/lib/loot";
import { createRunStreamRng, hashStringToUint32 } from "@/lib/rng";

interface OfferedCounts {
  astral: number;
  unique: number;
  trinket: number;
}

interface LootReportCell {
  source: LootSource;
  depth: number;
  account: DifficultyId | "none";
  collection: "fresh" | "nearly-complete";
  available: boolean;
  premiumScreenChance: number;
  offeredPerScreen: OfferedCounts;
}

const ROUTES: Record<string, ReadonlyArray<LootSource | "rest">> = {
  Campaign: [
    "normal",
    ...Array.from(
      { length: 3 },
      () => ["normal", "mystery", "normal", "equipment", "elite", "rest", "normal", "boss"] as const,
    ).flat(),
  ],
  Labyrinth: [
    "normal",
    "rest",
    "mystery",
    "equipment",
    "elite",
    "normal",
    "rest",
    "normal",
    "boss",
    "normal",
    "trinket",
    "mystery",
    "normal",
    "equipment",
    "elite",
    "normal",
    "rest",
    "boss",
    "normal",
    "mystery",
    "normal",
    "equipment",
    "elite",
    "boss",
  ],
  Wildwood: Array.from({ length: 24 }, () => "wildwood"),
};

function measureCell(
  source: LootSource,
  depth: number,
  account: DifficultyId | "none",
  collection: LootReportCell["collection"],
  samples: number,
): LootReportCell {
  const ownedUniqueIds = new Set(collection === "fresh" ? [] : uniqueItemList.slice(0, -2).map((entry) => entry.id));
  const trinketCount = collection === "fresh" ? trinketLibrary.length : 2;
  const available =
    source === "trinket"
      ? isLootEligible("trinket", depth)
      : source === "masterwork"
        ? isLootEligible("astral", depth)
        : true;
  const result: LootReportCell = {
    source,
    depth,
    account,
    collection,
    available,
    premiumScreenChance: 0,
    offeredPerScreen: { astral: 0, unique: 0, trinket: 0 },
  };
  if (!available) return result;
  const weights = resolveLootWeights({
    source,
    progress: { depth, highestCompletedDifficulty: account === "none" ? null : account },
    available: { ...getGearLootAvailability(ownedUniqueIds), trinket: trinketCount > 0 },
  });
  const rng = createRunStreamRng(hashStringToUint32(`loot-v1:${source}:${depth}:${account}:${collection}`), "rewards");
  for (let sample = 0; sample < samples; sample += 1) {
    const group = rollLootGroup(weights, rng);
    let premium = false;
    if (group === "trinket") {
      result.offeredPerScreen.trinket += Math.min(3, trinketCount);
      premium = true;
    } else if (group === "gear") {
      const choices = generateLootGearChoices(source === "mystery" ? 1 : 3, rng, weights, ownedUniqueIds);
      for (const choice of choices) {
        const rarity = gearDefinitions[choice.definitionId]?.rarity;
        if (rarity === "astral" || rarity === "unique") {
          result.offeredPerScreen[rarity] += 1;
          premium = true;
        }
      }
    }
    if (premium) result.premiumScreenChance += 1;
  }
  result.premiumScreenChance /= samples;
  for (const kind of ["astral", "unique", "trinket"] as const) result.offeredPerScreen[kind] /= samples;
  return result;
}

export function buildLootBalanceReport(samples = 1000) {
  if (!Number.isInteger(samples) || samples < 1) throw new Error("Loot report samples must be a positive integer");
  const depths = [
    ...new Set([
      1,
      ...Object.values(LOOT_DEPTH_CURVES).flatMap((curve) => curve.flatMap((point) => [point.depth - 1, point.depth])),
    ]),
  ].sort((a, b) => a - b);
  const cells: LootReportCell[] = [];
  const routes: Array<{
    name: string;
    account: LootReportCell["account"];
    collection: LootReportCell["collection"];
    offered: OfferedCounts;
    premiumScreens: number;
  }> = [];
  const cache = new Map<string, LootReportCell>();
  const measure = (
    source: LootSource,
    depth: number,
    account: LootReportCell["account"],
    collection: LootReportCell["collection"],
  ) => {
    const key = `${source}:${depth}:${account}:${collection}`;
    let cell = cache.get(key);
    if (!cell) {
      cell = measureCell(source, depth, account, collection, samples);
      cache.set(key, cell);
    }
    return cell;
  };
  for (const account of ["none", "difficulty-1", "difficulty-2", "difficulty-3"] as const) {
    for (const collection of ["fresh", "nearly-complete"] as const) {
      for (const source of Object.keys(LOOT_SOURCE_WEIGHTS) as LootSource[]) {
        for (const depth of depths) cells.push(measure(source, depth, account, collection));
      }
      for (const [name, steps] of Object.entries(ROUTES)) {
        const offered = { astral: 0, unique: 0, trinket: 0 };
        let premiumScreens = 0;
        for (const [index, source] of steps.entries()) {
          if (source === "rest") continue;
          const cell = measure(source, index + 1, account, collection);
          premiumScreens += cell.premiumScreenChance;
          for (const kind of ["astral", "unique", "trinket"] as const) offered[kind] += cell.offeredPerScreen[kind];
        }
        routes.push({ name, account, collection, offered, premiumScreens });
      }
    }
  }
  return { samplesPerCell: samples, seedVersion: "loot-v1", routeDefinitions: ROUTES, cells, routes };
}

export function renderLootBalanceReport(report: ReturnType<typeof buildLootBalanceReport>): string {
  const accountNames = {
    none: "No clear",
    "difficulty-1": "Novice",
    "difficulty-2": "Adventurer",
    "difficulty-3": "Legend",
  };
  const rows = report.cells
    .map(
      (cell) =>
        `<tr data-account="${cell.account}" data-collection="${cell.collection}"><td>${cell.source}</td><td>${cell.depth}</td><td>${cell.available ? `${(cell.premiumScreenChance * 100).toFixed(1)}%` : "Unavailable"}</td><td>${cell.offeredPerScreen.astral.toFixed(2)}</td><td>${cell.offeredPerScreen.unique.toFixed(2)}</td><td>${cell.offeredPerScreen.trinket.toFixed(2)}</td></tr>`,
    )
    .join("");
  const routes = report.routes
    .map(
      (route) =>
        `<tr data-account="${route.account}" data-collection="${route.collection}"><td>${route.name}</td><td>${route.premiumScreens.toFixed(2)}</td><td>${route.offered.astral.toFixed(2)}</td><td>${route.offered.unique.toFixed(2)}</td><td>${route.offered.trinket.toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Alchemy loot progression</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#e6e3ee;background:#17151e}h1,h2{color:#e9cc8a}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #393442}th{position:sticky;top:0;background:#28232f}select{padding:8px;margin:0 24px 0 8px}p{line-height:1.6}details{margin:24px 0}[hidden]{display:none}</style><h1>Alchemy loot progression</h1><p>Reproducible estimates from ${report.samplesPerCell.toLocaleString()} seeded screens per source, depth, account tier, and collection. Sampling error is at most approximately ±${(98 / Math.sqrt(report.samplesPerCell)).toFixed(1)} percentage points at 95% confidence per screen-rate estimate.</p><p>These numbers count <strong>offers, not acquisitions</strong>. Gear and Trinket rewards offer up to three choices; a player takes one. Shops list three items and may sell several; mystery Gear grants one. No shop refreshes are included. Collection ownership stays fixed along each route; exclusions within each screen use the live generator. “Nearly complete” leaves two Uniques and two permanent Trinkets unowned; Boons remain available. Loot bonuses other than account progress are zero.</p><label>Best account clear<select id="account">${Object.entries(
    accountNames,
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join(
      "",
    )}</select></label><label>Collection<select id="collection"><option value="fresh">Fresh</option><option value="nearly-complete">Nearly complete</option></select></label><h2>Expected offers over defined routes</h2><table><thead><tr><th>Route</th><th>Premium screens</th><th>Astrals offered</th><th>Uniques offered</th><th>Trinkets offered</th></tr></thead><tbody>${routes}</tbody></table><details><summary>Route definitions</summary>${Object.entries(
    report.routeDefinitions,
  )
    .map(
      ([name, steps]) =>
        `<p><strong>${name}</strong> (${steps.length} locations): ${steps.map((source, index) => `${index + 1}: ${source}`).join(" → ")}</p>`,
    )
    .join(
      "",
    )}<p>Campaign includes its opening battle, followed by three eight-destination Acts. Rest counts toward depth but offers no loot. The other routes are explicit comparison scenarios, not forecasts of the randomly generated map.</p></details><h2>Premium availability and offers per screen</h2><table><thead><tr><th>Source</th><th>Depth</th><th>At least one premium</th><th>Astrals</th><th>Uniques</th><th>Trinkets</th></tr></thead><tbody>${rows}</tbody></table><script>const account=document.getElementById('account'),collection=document.getElementById('collection');function filter(){document.querySelectorAll('tr[data-account]').forEach(row=>{row.hidden=row.dataset.account!==account.value||row.dataset.collection!==collection.value})}account.addEventListener('change',filter);collection.addEventListener('change',filter);filter();</script></html>`;
}

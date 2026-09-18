import { ACTS_PER_RUN, DESTINATIONS_PER_ACT, LOOT_DEPTH_CURVES, LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import { trinketLibrary, type DifficultyId } from "@/lib/game-data";
import { getRewardLootAvailability, uniqueItemList } from "@/lib/gear";
import { isLootEligible, resolveLootWeights, rollLootGearRarity, rollLootGroup, type LootSource } from "@/lib/loot";
import { createRunStreamRng, hashStringToUint32 } from "@/lib/rng";
import { escapeHtml, renderReportPage } from "./report-layout";

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

const NEARLY_COMPLETE_REMAINING_UNIQUES = 2;
const NEARLY_COMPLETE_REMAINING_TRINKETS = 2;

// One representative eight-destination Act. Labyrinth and Wildwood stay
// explicit comparison scenarios (see the report prose), but Campaign derives
// its act count and length from routing constants so it cannot drift from
// ACTS_PER_RUN × DESTINATIONS_PER_ACT.
const CAMPAIGN_ACT_PATTERN: ReadonlyArray<LootSource | "rest"> = [
  "normal",
  "mystery",
  "normal",
  "equipment",
  "elite",
  "rest",
  "normal",
  "boss",
];
if (CAMPAIGN_ACT_PATTERN.length !== DESTINATIONS_PER_ACT) {
  throw new Error("Campaign loot-report act pattern drifted from DESTINATIONS_PER_ACT");
}

const ROUTES: Record<string, ReadonlyArray<LootSource | "rest">> = {
  Campaign: ["normal", ...Array.from({ length: ACTS_PER_RUN }, () => CAMPAIGN_ACT_PATTERN).flat()],
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
  const ownedUniqueIds = new Set(
    collection === "fresh" ? [] : uniqueItemList.slice(0, -NEARLY_COMPLETE_REMAINING_UNIQUES).map((entry) => entry.id),
  );
  const trinketCount = collection === "fresh" ? trinketLibrary.length : NEARLY_COMPLETE_REMAINING_TRINKETS;
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
    available: getRewardLootAvailability(ownedUniqueIds, { trinkets: trinketCount > 0 }),
  });
  const rng = createRunStreamRng(hashStringToUint32(`loot-v2:${source}:${depth}:${account}:${collection}`), "rewards");
  for (let sample = 0; sample < samples; sample += 1) {
    const group = rollLootGroup(weights, rng);
    let premium = false;
    if (group === "trinket") {
      result.offeredPerScreen.trinket += Math.min(3, trinketCount);
      premium = true;
    } else if (group === "gear") {
      // Count rarities directly instead of generating full gear instances:
      // the report needs offer rates, not affixes or instance IDs. Unique
      // rolls stop once the screen has offered every remaining unique.
      const choiceCount = source === "mystery" ? 1 : 3;
      const remainingUniques = uniqueItemList.length - ownedUniqueIds.size;
      let offeredUniques = 0;
      for (let choice = 0; choice < choiceCount; choice += 1) {
        const rarity = rollLootGearRarity(weights, rng, offeredUniques < remainingUniques ? {} : { unique: false });
        if (rarity === "astral" || rarity === "unique") {
          result.offeredPerScreen[rarity] += 1;
          premium = true;
          if (rarity === "unique") offeredUniques += 1;
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
  if (samples > 10_000) throw new Error("Loot report samples capped at 10,000 per cell to bound runtime");
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
  return { samplesPerCell: samples, seedVersion: "loot-v2", routeDefinitions: ROUTES, cells, routes };
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
        `<tr data-account="${cell.account}" data-collection="${cell.collection}"><td>${escapeHtml(cell.source)}</td><td>${cell.depth}</td><td>${cell.available ? `${(cell.premiumScreenChance * 100).toFixed(1)}%` : "Unavailable"}</td><td>${cell.offeredPerScreen.astral.toFixed(2)}</td><td>${cell.offeredPerScreen.unique.toFixed(2)}</td><td>${cell.offeredPerScreen.trinket.toFixed(2)}</td></tr>`,
    )
    .join("\n");
  const routes = report.routes
    .map(
      (route) =>
        `<tr data-account="${route.account}" data-collection="${route.collection}"><td>${escapeHtml(route.name)}</td><td>${route.premiumScreens.toFixed(2)}</td><td>${route.offered.astral.toFixed(2)}</td><td>${route.offered.unique.toFixed(2)}</td><td>${route.offered.trinket.toFixed(2)}</td></tr>`,
    )
    .join("\n");
  const accountOptions = Object.entries(accountNames)
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join("");
  const routeDefinitions = Object.entries(report.routeDefinitions)
    .map(
      ([name, steps]) =>
        `<p><strong>${escapeHtml(name)}</strong> (${steps.length} locations): ${steps.map((source, index) => `${index + 1}: ${escapeHtml(source)}`).join(" → ")}</p>`,
    )
    .join("\n");
  const body = `<h1>Alchemy loot progression</h1><p>Reproducible estimates from ${report.samplesPerCell.toLocaleString()} seeded screens per source, depth, account tier, and collection. Sampling error is at most approximately ±${(98 / Math.sqrt(report.samplesPerCell)).toFixed(1)} percentage points at 95% confidence per screen-rate estimate.</p><p>These numbers count <strong>offers, not acquisitions</strong>. Gear and Trinket rewards offer up to three choices; a player takes one. Shops list three items and may sell several; mystery Gear grants one. No shop refreshes are included. Collection ownership stays fixed along each route; per-choice exclusions within each screen are approximated by rolling rarities directly rather than generating full instances. “Nearly complete” leaves ${NEARLY_COMPLETE_REMAINING_UNIQUES} Uniques and ${NEARLY_COMPLETE_REMAINING_TRINKETS} permanent Trinkets unowned; Boons remain available. Loot bonuses other than account progress are zero.</p><label>Best account clear<select id="account">${accountOptions}</select></label><label>Collection<select id="collection"><option value="fresh">Fresh</option><option value="nearly-complete">Nearly complete</option></select></label><h2>Expected offers over defined routes</h2><div class="scroll"><table><thead><tr><th>Route</th><th>Premium screens</th><th>Astrals offered</th><th>Uniques offered</th><th>Trinkets offered</th></tr></thead><tbody>${routes}</tbody></table></div><details><summary>Route definitions</summary>${routeDefinitions}<p>Campaign includes its opening battle, followed by ${ACTS_PER_RUN} ${DESTINATIONS_PER_ACT}-destination Acts. Rest counts toward depth but offers no loot. The other routes are explicit comparison scenarios, not forecasts of the randomly generated map.</p></details><h2>Premium availability and offers per screen</h2><div class="scroll"><table><thead><tr><th>Source</th><th>Depth</th><th>At least one premium</th><th>Astrals</th><th>Uniques</th><th>Trinkets</th></tr></thead><tbody>${rows}</tbody></table><script>const account=document.getElementById('account'),collection=document.getElementById('collection');function filter(){document.querySelectorAll('tr[data-account]').forEach(row=>{row.hidden=row.dataset.account!==account.value||row.dataset.collection!==collection.value})}account.addEventListener('change',filter);collection.addEventListener('change',filter);filter();</script>`;
  return renderReportPage({
    title: "Alchemy loot progression",
    body,
    extraStyle: [
      "th { position: sticky; top: 0; }",
      "select { padding: 8px; margin: 0 24px 0 8px; }",
      "p { line-height: 1.6; }",
      "details { margin: 24px 0; }",
      "[hidden] { display: none; }",
    ].join("\n"),
  });
}

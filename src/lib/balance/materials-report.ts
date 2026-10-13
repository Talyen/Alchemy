import { createRunStreamRng, hashStringToUint32 } from "@/lib/rng";
import { getCombatMaterialLoot } from "@/lib/homestead/material-rewards";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { renderReportPage } from "./report-layout";

const MATERIALS_REPORT_SAMPLES = 20_000;
const MATERIALS_REPORT_SEED_VERSION = "materials-v2";

interface MaterialsReportRow {
  progressionBand: number;
  enemyType: "normal" | "elite" | "boss";
  mean: MaterialInventory;
}

export interface MaterialsBalanceReport {
  samplesPerCell: number;
  seedVersion: string;
  rows: MaterialsReportRow[];
}

function meanLoot(
  progressionBand: number,
  enemyType: MaterialsReportRow["enemyType"],
  samples: number,
): MaterialInventory {
  const totals = emptyInventory();
  const rng = createRunStreamRng(
    hashStringToUint32(`${MATERIALS_REPORT_SEED_VERSION}:${progressionBand}:${enemyType}`),
    "rewards",
  );
  for (let sample = 0; sample < samples; sample += 1) {
    const loot = getCombatMaterialLoot(enemyType, progressionBand, rng);
    for (const material of MATERIAL_IDS) totals[material] += loot[material] ?? 0;
  }
  const mean = emptyInventory();
  for (const material of MATERIAL_IDS) mean[material] = totals[material] / samples;
  return mean;
}

export function buildMaterialsBalanceReport(samples = MATERIALS_REPORT_SAMPLES): MaterialsBalanceReport {
  if (!Number.isInteger(samples) || samples < 1) throw new Error("Materials report samples must be a positive integer");
  if (samples > 100_000) throw new Error("Materials report samples capped at 100,000 per cell to bound runtime");
  const rows: MaterialsReportRow[] = [];
  for (const progressionBand of [1, 2, 3]) {
    for (const enemyType of ["normal", "elite", "boss"] as const) {
      rows.push({ progressionBand, enemyType, mean: meanLoot(progressionBand, enemyType, samples) });
    }
  }
  return { samplesPerCell: samples, seedVersion: MATERIALS_REPORT_SEED_VERSION, rows };
}

function materialCells(mean: MaterialInventory): string {
  return MATERIAL_IDS.map((material) => `<td>${mean[material].toFixed(2)}</td>`).join("");
}

export function renderMaterialsBalanceReport(report: MaterialsBalanceReport): string {
  const rows = report.rows
    .map((row) => `<tr><td>${row.progressionBand}</td><td>${row.enemyType}</td>${materialCells(row.mean)}</tr>`)
    .join("\n");
  const header = MATERIAL_IDS.map((material) => `<th>${material}</th>`).join("");
  const body = `<h1>Alchemy materials progression</h1><p>Mean materials paid per victory from ${report.samplesPerCell.toLocaleString()} seeded rolls per progression band and encounter type through the shared combat material policy. Campaign uses act, Labyrinth uses floor, and Wildwood uses boss number, capped at band 3. Each bundle selects one of seven equally likely materials, with replacement. These are base payouts before build-dependent modifiers: homestead herb-find, scavenger doubling, herbalist bonus, and end-of-run per-room yields all apply afterwards (see the reward policy table in <code>src/lib/homestead/material-rewards.ts</code>).</p><table><thead><tr><th>Band</th><th>Type</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  return renderReportPage({ title: "Alchemy materials progression", body });
}

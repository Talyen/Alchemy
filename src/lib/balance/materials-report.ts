import { createRunStreamRng, hashStringToUint32 } from "@/lib/rng";
import { enemyLootTables, getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { escapeHtml, renderReportPage } from "./report-layout";

const MATERIALS_REPORT_SAMPLES = 20_000;
const MATERIALS_REPORT_SEED_VERSION = "materials-v1";

interface MaterialsReportRow {
  enemyId: string;
  enemyType: "normal" | "elite" | "boss";
  mean: MaterialInventory;
}

export interface MaterialsBalanceReport {
  samplesPerCell: number;
  seedVersion: string;
  rows: MaterialsReportRow[];
}

function zeroInventory(): MaterialInventory {
  return { wood: 0, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 };
}

function meanLoot(enemyId: string, enemyType: MaterialsReportRow["enemyType"], samples: number): MaterialInventory {
  const totals = zeroInventory();
  const rng = createRunStreamRng(
    hashStringToUint32(`${MATERIALS_REPORT_SEED_VERSION}:${enemyId}:${enemyType}`),
    "rewards",
  );
  for (let sample = 0; sample < samples; sample += 1) {
    const loot = getEnemyMaterialLoot(enemyId, enemyType, rng);
    for (const material of MATERIAL_IDS) totals[material] += loot[material] ?? 0;
  }
  const mean = zeroInventory();
  for (const material of MATERIAL_IDS) mean[material] = totals[material] / samples;
  return mean;
}

export function buildMaterialsBalanceReport(samples = MATERIALS_REPORT_SAMPLES): MaterialsBalanceReport {
  if (!Number.isInteger(samples) || samples < 1) throw new Error("Materials report samples must be a positive integer");
  if (samples > 100_000) throw new Error("Materials report samples capped at 100,000 per cell to bound runtime");
  const rows: MaterialsReportRow[] = [];
  for (const enemyId of Object.keys(enemyLootTables).sort()) {
    for (const enemyType of ["normal", "elite", "boss"] as const) {
      rows.push({ enemyId, enemyType, mean: meanLoot(enemyId, enemyType, samples) });
    }
  }
  return { samplesPerCell: samples, seedVersion: MATERIALS_REPORT_SEED_VERSION, rows };
}

function materialCells(mean: MaterialInventory): string {
  return MATERIAL_IDS.map((material) => `<td>${mean[material].toFixed(2)}</td>`).join("");
}

export function renderMaterialsBalanceReport(report: MaterialsBalanceReport): string {
  const rows = report.rows
    .map((row) => `<tr><td>${escapeHtml(row.enemyId)}</td><td>${row.enemyType}</td>${materialCells(row.mean)}</tr>`)
    .join("\n");
  const header = MATERIAL_IDS.map((material) => `<th>${material}</th>`).join("");
  const body = `<h1>Alchemy materials progression</h1><p>Mean materials paid per victory from ${report.samplesPerCell.toLocaleString()} seeded rolls per enemy and enemy type through the live enemy loot tables, including elite and boss multipliers with battle-standard rounding. These are base payouts before build-dependent modifiers: homestead herb-find, scavenger doubling, herbalist bonus, and end-of-run per-room yields all apply afterwards (see the reward policy table in <code>src/lib/homestead/loot.ts</code>).</p><table><thead><tr><th>Enemy</th><th>Type</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  return renderReportPage({ title: "Alchemy materials progression", body });
}

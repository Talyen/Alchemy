import { type CompanionId } from "@/lib/game-data";
import { companionSummonCardId } from "@/lib/homestead/companions";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import type {
  BuildingId,
  FarmId,
  MaterialInventory as ProfileMaterialInventory,
  ResearchId,
} from "@/lib/homestead/types";
import type { GameplayDraft } from "../../session/gameplay-command";
import * as homestead from "../homestead-actions";
import { rebindLiveRunMeta } from "./live-meta";
import { addRunMaterialsEarned } from "./run-progress";

// ── Homestead ────────────────────────────────────────────────────────────────
// Dual-write refresher: `runProfile.materialInventory` is the stockpile;
// `run.activeRun.runMaterialsEarned` tallies what the live run earned.
// `awardMaterialsDuringRun` writes both; `addMaterialsToStockpile` writes the
// stockpile only (refunds, meta salvage).

function grantMaterials(
  draft: GameplayDraft,
  materials: ProfileMaterialInventory,
  options: { trackRunEarned?: boolean } = {},
): void {
  const before = { ...draft.runProfile.materialInventory };
  homestead.addMaterials(draft.runProfile, materials);
  if (options.trackRunEarned) {
    const credited = { ...materials };
    for (const id of MATERIAL_IDS) credited[id] = draft.runProfile.materialInventory[id] - before[id];
    addRunMaterialsEarned(draft, credited);
  }
}

export function awardMaterialsDuringRun(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials, { trackRunEarned: true });
}

export function resolveStarterHomesteadGrant(draft: GameplayDraft): void {
  draft.runProfile.starterHomesteadGrantResolved = true;
}

export function setMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  homestead.setMaterials(draft.runProfile, materials);
}

// Stockpile-only grant: refunds and meta salvage. Run-earned
// materials must use `awardMaterialsDuringRun` so the run tally stays accurate
// (enforced by `alchemy/no-run-earned-add-materials`).
export function addMaterialsToStockpile(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials);
}

function rebindOnSuccess(ok: boolean, draft: GameplayDraft): boolean {
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  return rebindOnSuccess(homestead.constructBuilding(draft.runProfile, id), draft);
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  return rebindOnSuccess(homestead.plantFarm(draft.runProfile, id), draft);
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  return rebindOnSuccess(homestead.completeResearch(draft.runProfile, id), draft);
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  const cardId = companionSummonCardId(id);
  if (!cardId || !draft.profile.discoveredCardIds.includes(cardId)) return false;
  return rebindOnSuccess(homestead.bondCompanion(draft.runProfile, id), draft);
}

export function resetHomestead(draft: GameplayDraft): boolean {
  return rebindOnSuccess(homestead.resetHomestead(draft.runProfile), draft);
}
